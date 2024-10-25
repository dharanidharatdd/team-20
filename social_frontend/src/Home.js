import React, { useState, useEffect } from "react";
import axios from "axios";

function Home({ token }) {
    // State to manage the comment input field
    const [commentInput, setCommentInput] = useState("");
    // State to manage the list of posts
    const [posts, setPosts] = useState([]);

    // useEffect to fetch posts when the component mounts or when the token changes
    useEffect(() => {
        if (token) {
            axios
                .get("http://localhost:5000/api/posts", {
                    headers: {
                        'Authorization': token
                    }
                })
                .then((response) => setPosts(response.data)) // Set the posts state with the fetched data
                .catch((error) => console.error("Error fetching posts:", error)); // Log any errors
        }
    }, [token]);

    // Function to handle liking a post
    const handleLike = (postId) => {
        axios
            .post(`http://localhost:5000/api/posts/like/${postId}`, {}, {
                headers: {
                    'Authorization': token
                }
            })
            .then((response) => {
                // Update the posts state with the liked post data
                const updatedPosts = posts.map((post) =>
                    post._id === postId ? response.data : post
                );
                setPosts(updatedPosts);
            })
            .catch((error) => console.error("Error liking post:", error)); // Log any errors
    };

    // Function to handle adding a comment to a post
    const handleAddComment = (postId, commentText) => {
        axios
            .post(`http://localhost:5000/api/posts/comment/${postId}`, {
                text: commentText,
            }, {
                headers: {
                    'Authorization': token
                }
            })
            .then((response) => {
                // Update the posts state with the commented post data
                const updatedPosts = posts.map((post) =>
                    post._id === postId ? response.data : post
                );
                setPosts(updatedPosts);
                setCommentInput(""); // Reset comment input
            })
            .catch((error) => console.error("Error adding comment:", error)); // Log any errors
    };

    return (
        <div className="home">
            <h2>Recent Posts</h2>
            {/* Render posts in reverse order */}
            {posts.slice().reverse().map((post) => (
                <div key={post._id} className="post">
                    {/* Display post title, flagging inappropriate content */}
                    <h3 style={{ color: post.isFlagged ? 'red' : 'inherit' }}>
                        {post.isFlagged ? "This title is hidden due to inappropriate content." : post.title}
                    </h3>
                    {/* Display post content, flagging inappropriate content */}
                    <p style={{ color: post.isFlagged ? 'red' : 'inherit' }}>
                        {post.isFlagged ? "This content is hidden due to inappropriate content." : post.content}
                    </p>
                    {/* Display post media if available */}
                    {post.file && (
                        <div>
                            {post.file.includes(".mp4") ? (
                                <video width="320" height="240" controls>
                                    <source
                                        src={`http://localhost:5000/uploads/${post.file}`}
                                        type="video/mp4"
                                    />
                                    Your browser does not support the video tag.
                                </video>
                            ) : (
                                <img
                                    src={`http://localhost:5000/uploads/${post.file}`}
                                    alt="Post Media"
                                />
                            )}
                        </div>
                    )}
                    {/* Display number of likes */}
                    <p>Likes: {post.likes}</p>
                    {/* Button to like the post */}
                    <button onClick={() => handleLike(post._id)}>Like</button>
                    {/* Display number of comments */}
                    <p>Comments: {post.comments.length}</p>
                    {/* List of comments */}
                    <ul>
                        {post.comments.map((comment, index) => (
                            <li key={index} style={{ color: comment.isFlagged ? 'red' : 'inherit' }}>
                                {comment.isFlagged ? "This comment is hidden due to inappropriate content." : comment.text}
                            </li>
                        ))}
                    </ul>
                    {/* Input field to add a new comment */}
                    <input
                        type="text"
                        placeholder="Add a comment"
                        className="comment-input"
                        value={commentInput}
                        onChange={(e) => setCommentInput(e.target.value)}
                    />
                    {/* Button to add the comment */}
                    <button
                        onClick={() => handleAddComment(post._id, commentInput)}
                        className="comment-button"
                    >
                        Add Comment
                    </button>
                </div>
            ))}
        </div>
    );
}

export default Home;