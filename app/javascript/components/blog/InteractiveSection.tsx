import React, { useState } from 'react';

interface PostedComment {
  text: string;
  postedAt: string;
}

export function InteractiveSection() {
  const [likes, setLikes] = useState(42);
  const [liked, setLiked] = useState(false);
  const [comment, setComment] = useState('');
  const [postedComments, setPostedComments] = useState<PostedComment[]>([]);
  const [posted, setPosted] = useState(false);

  const handleLike = () => {
    setLiked(!liked);
    setLikes((prev) => (liked ? prev - 1 : prev + 1));
  };

  const handlePost = () => {
    const trimmed = comment.trim();
    if (!trimmed) return;
    setPostedComments((prev) => [...prev, { text: trimmed, postedAt: new Date().toLocaleTimeString() }]);
    setComment('');
    setPosted(true);
    setTimeout(() => setPosted(false), 1500);
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
            onClick={handlePost}
          >
            Post Comment
          </button>
        )}
        {posted && (
          <p className="mt-2 text-xs text-green-600">Comment posted (local-only — not persisted).</p>
        )}
      </div>

      {postedComments.length > 0 && (
        <ul className="mt-6 space-y-3">
          {postedComments.map((c, i) => (
            <li key={i} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{c.text}</p>
              <p className="mt-1 text-xs text-gray-400">Posted at {c.postedAt}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
