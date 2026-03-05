import React, { useState } from 'react';

export function InteractiveSection() {
  const [likes, setLikes] = useState(42);
  const [liked, setLiked] = useState(false);
  const [comment, setComment] = useState('');

  const handleLike = () => {
    setLiked(!liked);
    setLikes((prev) => (liked ? prev - 1 : prev + 1));
  };

  return (
    <section className="mt-10 pt-8 border-t border-gray-200">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={handleLike}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            liked
              ? 'bg-red-50 text-red-600 border border-red-200'
              : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
          }`}
        >
          <span>{liked ? '\u2764\ufe0f' : '\u2661'}</span>
          <span>{likes}</span>
        </button>
      </div>

      <div>
        <label htmlFor="blog-comment" className="block text-sm font-medium text-gray-700 mb-2">
          Leave a comment
        </label>
        <textarea
          id="blog-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Share your thoughts..."
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
        />
        {comment.length > 0 && (
          <button
            className="mt-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            onClick={() => setComment('')}
          >
            Post Comment
          </button>
        )}
      </div>
    </section>
  );
}
