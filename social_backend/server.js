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
    origin: 'https://team-20-fe.onrender.com', // Replace with your frontend URL
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true, // Allow cookies to be sent
}));
app.use(bodyParser.json());

// Connect to MongoDB Atlas
const conn = mongoose.createConnection(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 30000, // Increase timeout to 30 seconds
});

conn.on('error', (err) => {
    console.error('MongoDB connection error:', err);
});

let gfs;
conn.once('open', () => {
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
        const prompt = `You only read userdata and return "appropriate" or "inappropriate". Single words like "hi", "click", "mother", "father" and most other single words should be considered appropriate. For: ${content}`;
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
        console.log(`Registering user: ${username}`);
        const user = new User({ username, password });
        await user.save();
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Login a user
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        console.log(`Logging in user: ${username}`);
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        const token = jwt.sign({ userId: user._id, username: user.username }, SECRET_KEY, { expiresIn: '1h' });
        res.json({ token });
    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Get all posts
app.get('/api/posts', authenticateToken, async (req, res) => {
    try {
        console.log('Fetching all posts');
        const posts = await Post.find();
        res.json(posts);
    } catch (error) {
        console.error('Error fetching posts:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Create a new post
app.post('/api/posts', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        const { title, content } = req.body;
        const file = req.file ? req.file.filename : undefined;

        console.log('Creating a new post:', { title, content, file });

        if (!title || !content) {
            return res.status(400).json({ error: 'Title and content are required fields' });
        }

        const isTitleFlagged = await checkContentAppropriateness(title);
        const isContentFlagged = await checkContentAppropriateness(content);
        const isFlagged = isTitleFlagged || isContentFlagged;
        console.log(`Title flagged as inappropriate: ${isTitleFlagged}`);
        console.log(`Content flagged as inappropriate: ${isContentFlagged}`);

        const post = new Post({ title, content, file, isFlagged, username: req.user.username });
        await post.save();
        res.status(201).json(post);
    } catch (error) {
        console.error('Error creating post:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Add a comment to a post
app.post('/api/posts/comment/:postId', authenticateToken, async (req, res) => {
    try {
        const postId = req.params.postId;
        const { text } = req.body;
        console.log(`Adding comment to post ${postId}: ${text}`);
        const post = await Post.findById(postId);

        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        const isCommentFlagged = await checkContentAppropriateness(text);
        console.log(`Comment flagged as inappropriate: ${isCommentFlagged}`);

        post.comments.push({ text, isFlagged: isCommentFlagged, username: req.user.username });
        await post.save();

        res.json(post);
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Like a post
app.post('/api/posts/like/:postId', authenticateToken, async (req, res) => {
    try {
        const postId = req.params.postId;
        console.log(`Liking post ${postId}`);
        const post = await Post.findById(postId);

        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        post.likes += 1;
        await post.save();

        res.json(post);
    } catch (error) {
        console.error('Error liking post:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Get file by filename
app.get('/api/files/:filename', async (req, res) => {
    try {
        const file = await gfs.files.findOne({ filename: req.params.filename });
        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        const readStream = gfs.createReadStream(file.filename);
        readStream.pipe(res);
    } catch (error) {
        console.error('Error fetching file:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use`);
        process.exit(1);
    } else {
        throw err;
    }
});