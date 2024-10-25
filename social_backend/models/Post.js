// models/Post.js

// Import mongoose to interact with MongoDB
const mongoose = require('mongoose');

// Define the schema for a Post
const postSchema = new mongoose.Schema({
    title: String, // Title of the post
    content: String, // Content of the post
    likes: { type: Number, default: 0 }, // Number of likes, default is 0
    comments: [{ text: String }], // Array of comments, each with a text field
});

// Create a model from the schema
const Post = mongoose.model('Post', postSchema);

// Export the model to use it in other parts of the application
module.exports = Post;
