import React, { useState } from 'react';

export function BookmarkShareBar() {
  const [bookmarked, setBookmarked] = useState(false);
  const [shared, setShared] = useState(false);
  const [copyLabel, setCopyLabel] = useState('Copy Link');

  const handleBookmark = () => {
    setBookmarked((prev) => !prev);
  };

  const handleShare = () => {
    setCopyLabel('Copied!');
    setShared(true);
    setTimeout(() => {
      setCopyLabel('Copy Link');
      setShared(false);
    }, 2000);
  };

  return (
    <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-200 -mx-4 px-4 py-3 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBookmark}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              bookmarked
                ? 'bg-yellow-50 text-yellow-700 border border-yellow-300'
                : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
            }`}
          >
            <svg
              className="w-4 h-4"
              fill={bookmarked ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
              />
            </svg>
            {bookmarked ? 'Bookmarked' : 'Bookmark'}
          </button>

          <button
            onClick={handleShare}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              shared
                ? 'bg-green-50 text-green-700 border border-green-300'
                : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
            </svg>
            {copyLabel}
          </button>
        </div>

        <span className="text-xs text-gray-400">Try clicking before hydration completes</span>
      </div>
    </div>
  );
}
