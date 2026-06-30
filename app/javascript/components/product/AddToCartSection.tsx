import React, { useState, useCallback } from 'react';

interface Props {
  price: number;
  inStock: boolean;
  stockQuantity: number;
}

export function AddToCartSection({ price, inStock, stockQuantity }: Props) {
  const [quantity, setQuantity] = useState(1);
  const [addedToCart, setAddedToCart] = useState(false);

  const handleDecrement = useCallback(() => {
    setQuantity((q) => Math.max(1, q - 1));
  }, []);

  const handleIncrement = useCallback(() => {
    setQuantity((q) => Math.min(stockQuantity, q + 1));
  }, [stockQuantity]);

  const [buyingNow, setBuyingNow] = useState(false);

  const handleAddToCart = useCallback(() => {
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  }, []);

  const handleBuyNow = useCallback(() => {
    setBuyingNow(true);
    setTimeout(() => setBuyingNow(false), 2000);
  }, []);

  return (
    <div className="space-y-4">
      {/* Quantity selector */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-gray-700">Quantity</span>
        <div className="flex items-center border border-gray-300 rounded-lg">
          <button
            onClick={handleDecrement}
            disabled={quantity <= 1}
            className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded-l-lg"
            aria-label="Decrease quantity"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" d="M5 12h14" />
            </svg>
          </button>
          <span className="w-12 text-center text-sm font-medium tabular-nums">{quantity}</span>
          <button
            onClick={handleIncrement}
            disabled={quantity >= stockQuantity}
            className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded-r-lg"
            aria-label="Increase quantity"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" d="M12 5v14m-7-7h14" />
            </svg>
          </button>
        </div>
      </div>

      {/* Add to Cart & Buy Now buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleAddToCart}
          disabled={!inStock}
          className={`flex-1 py-3.5 px-6 rounded-xl text-sm font-semibold transition-all ${
            addedToCart
              ? 'bg-green-600 text-white'
              : inStock
                ? 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.98]'
                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
          }`}
        >
          {addedToCart ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Added to Cart
            </span>
          ) : (
            `Add to Cart — $${(price * quantity).toFixed(2)}`
          )}
        </button>
        <button
          onClick={handleBuyNow}
          disabled={!inStock}
          className={`py-3.5 px-6 rounded-xl text-sm font-semibold border-2 transition-all active:scale-[0.98] ${
            buyingNow
              ? 'bg-green-600 text-white border-green-600'
              : 'border-indigo-600 text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 disabled:cursor-not-allowed'
          }`}
        >
          {buyingNow ? 'Order placed!' : 'Buy Now'}
        </button>
      </div>

      {/* Stock & shipping info */}
      <div className="flex flex-col gap-2 pt-2">
        {inStock ? (
          <div className="flex items-center gap-2 text-sm text-green-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            In Stock ({stockQuantity} available)
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-red-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Out of Stock
          </div>
        )}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          Free shipping on orders over $50
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          30-day hassle-free returns
        </div>
      </div>
    </div>
  );
}
