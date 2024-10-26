const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Grid = require('gridfs-stream');
const { GridFsStorage } = require('multer-gridfs-storage');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 5000;
const SECRET_KEY = process.env.SECRET_KEY;

// Middleware setup
app.use(cors({
    origin: 'https://team-20-fe.onrender.com', // Replace with your frontend domain
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());

// Connect to MongoDB Atlas
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB Atlas'))
.catch((error) => console.error('Error connecting to MongoDB Atlas:', error));

const conn = mongoose.connection;
let gfs;

conn.once('open', () => {
    console.log('MongoDB connection established successfully');
    gfs = Grid(conn.db, mongoose.mongo);
    gfs.collection('uploads');
});

// Create storage engine
const storage = new GridFsStorage({
    url: process.env.MONGODB_URI,
    file: (req, file) => {
        return {
            bucketName: 'uploads',
            filename: file.fieldname + '-' + Date.now() + path.extname(file.originalname),
        };
    },
});

const upload = multer({ storage });

// Define User schema and model
const userSchema = new mongoose.Schema({
    username: { type: String, unique: true },
    password: String,
});

// Hash password before saving user
userSchema.pre('save', async function (next) {
    if (this.isModified('password') || this.isNew) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
});

// Method to compare passwords
userSchema.methods.comparePassword = function (password) {
    return bcrypt.compare(password, this.password);
};

const User = mongoose.model('User', userSchema);

// Define Post schema and model
const postSchema = new mongoose.Schema({
    title: String,
    content: String,
    file: String,
    likes: { type: Number, default: 0 },
    comments: [{ text: String, isFlagged: { type: Boolean, default: false }, username: String }],
    isFlagged: { type: Boolean, default: false },
    username: String,
});

const Post = mongoose.model('Post', postSchema);

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).json({ error: 'Access denied' });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
    });
};

// Function to check content appropriateness
async function checkContentAppropriateness(content) {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        console.error("API key is missing. Please set it in the .env file.");
        return false;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    try {
        const prompt = `You only read userdata and return "appropriate" or "inappropriate". Single words like "hi", "click", "mother", "father" and most other single words should be considered appropriate, You can consider hate speach as inappropriate as well. For: ${content}`;
        console.log(`Checking content appropriateness for: ${content}`);
        const result = await model.generateContent(prompt);
        const response = result.response.text().trim();
        console.log(`API response: ${response}`);

        // Return true if the content is inappropriate
        return response.toLowerCase() === 'inappropriate';
    } catch (error) {
        console.error("Error checking content:", error.message);
        // Flag as inappropriate if blocked due to safety concerns
        if (error.message.includes("Candidate was blocked due to SAFETY")) {
            return true;
        }
        return false;
    }
}

// Register a new user
app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = new User({ username, password });
        await user.save();
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Error registering user' });
    }
});

// Login a user
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const token = jwt.sign({ id: user._id, username: user.username }, SECRET_KEY, { expiresIn: '1h' });
        res.json({ token });
    } catch (error) {
        res.status(500).json({ error: 'Error logging in' });
    }
});

// Get all posts
app.get('/api/posts', authenticateToken, async (req, res) => {
    try {
        const posts = await Post.find();
        res.json(posts);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching posts' });
    }
});

// Create a new post
app.post('/api/posts', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        const { title, content } = req.body;
        const file = req.file ? req.file.filename : null;
        const post = new Post({ title, content, file, username: req.user.username });
        await post.save();
        res.status(201).json(post);
    } catch (error) {
        res.status(500).json({ error: 'Error creating post' });
    }
});

// Add a comment to a post
app.post('/api/posts/comment/:postId', authenticateToken, async (req, res) => {
    try {
        const { text } = req.body;
        const post = await Post.findById(req.params.postId);
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }
        post.comments.push({ text, username: req.user.username });
        await post.save();
        res.json(post);
    } catch (error) {
        res.status(500).json({ error: 'Error adding comment' });
    }
});

// Like a post
app.post('/api/posts/like/:postId', authenticateToken, async (req, res) => {
    try {
        const post = await Post.findById(req.params.postId);
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }
        post.likes += 1;
        await post.save();
        res.json(post);
    } catch (error) {
        res.status(500).json({ error: 'Error liking post' });
    }
});

// Get file by filename
app.get('/api/files/:filename', async (req, res) => {
    try {
        const file = await gfs.files.findOne({ filename: req.params.filename });
        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }
        const readstream = gfs.createReadStream(file.filename);
        readstream.pipe(res);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching file' });
    }
});

// Test route to verify MongoDB operations
app.get('/api/test', async (req, res) => {
    try {
        res.json({ message: 'API is working' });
    } catch (error) {
        res.status(500).json({ error: 'Error testing API' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use`);
    } else {
        console.error('Server error:', err);
    }
});