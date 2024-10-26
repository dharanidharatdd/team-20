import React, { useState, useEffect } from "react";
import axios from "axios";

function Home({ token }) {
    const [commentInput, setCommentInput] = useState("");
    const [posts, setPosts] = useState([]);

    useEffect(() => {
        if (token) {
            console.log('Fetching posts with token:', token);
            axios
                .get(`${process.env.REACT_APP_API_URL}/api/posts`, {
                    headers: {
                        'Authorization': token
                    }
                })
                .then((response) => {
                    console.log('Posts fetched successfully:', response.data);
                    setPosts(response.data);
                })
                .catch((error) => console.error("Error fetching posts:", error));
        }
    }, [token]);

    const handleLike = (postId) => {
        console.log('Liking post:', postId);
        axios
            .post(`${process.env.REACT_APP_API_URL}/api/posts/like/${postId}`, {}, {
                headers: {
                    'Authorization': token
                }
            })
            .then((response) => {
                console.log('Post liked successfully:', response.data);
                const updatedPosts = posts.map((post) =>
                    post._id === postId ? response.data : post
                );
                setPosts(updatedPosts);
            })
            .catch((error) => console.error("Error liking post:", error));
    };

    const handleAddComment = (postId, commentText) => {
        console.log('Adding comment to post:', postId, 'Comment:', commentText);
        axios
            .post(`${process.env.REACT_APP_API_URL}/api/posts/comment/${postId}`, {
                text: commentText,
            }, {
                headers: {
                    'Authorization': token
                }
            })
            .then((response) => {
                console.log('Comment added successfully:', response.data);
                const updatedPosts = posts.map((post) =>
                    post._id === postId ? response.data : post
                );
                setPosts(updatedPosts);
                setCommentInput("");
            })
            .catch((error) => console.error("Error adding comment:", error));
    };

    return (
        <div className="home">
            <h2>Recent Posts</h2>
            {posts.slice().reverse().map((post) => (
                <div key={post._id} className="post">
                    <h3 style={{ color: post.isFlagged ? 'red' : 'inherit' }}>
                        {post.isFlagged ? "This title is hidden due to inappropriate content." : post.title}
                    </h3>
                    <p style={{ color: post.isFlagged ? 'red' : 'inherit' }}>
                        {post.isFlagged ? "This content is hidden due to inappropriate content." : post.content}
                    </p>
                    <p>Posted by: {post.username}</p>
                    {post.file && (
                        <div>
                            {post.file.includes(".mp4") ? (
                                <video width="320" height="240" controls>
                                    <source
                                        src={`${process.env.REACT_APP_API_URL}/uploads/${post.file}`}
                                        type="video/mp4"
                                    />
                                    Your browser does not support the video tag.
                                </video>
                            ) : (
                                <img
                                    src={`${process.env.REACT_APP_API_URL}/uploads/${post.file}`}
                                    alt="Post Media"
                                />
                            )}
                        </div>
                    )}
                    <p>Likes: {post.likes}</p>
                    <button onClick={() => handleLike(post._id)}>Like</button>
                    <p>Comments: {post.comments.length}</p>
                    <ul>
                        {post.comments.map((comment, index) => (
                            <li key={index} style={{ color: comment.isFlagged ? 'red' : 'inherit' }}>
                                {comment.isFlagged ? "This comment is hidden due to inappropriate content." : comment.text}
                                <span style={{ color: 'lightgray' }}> - {comment.username}</span>
                            </li>
                        ))}
                    </ul>
                    <input
                        type="text"
                        placeholder="Add a comment"
                        className="comment-input"
                        value={commentInput}
                        onChange={(e) => setCommentInput(e.target.value)}
                    />
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