// web/src/components/HeadlinesList.tsx

import { useEffect, useState } from "react";

import {
  PAGE_SIZE,
  safeExternalUrl,
  type NewsArticle
} from "../lib/newsapi";

export type ReaderMode = "live" | "favorites";

interface HeadlinesListProps {
  mode: ReaderMode;
  heading: string;
  subtitle: string;
  article: NewsArticle | null;
  articlesOnPage: NewsArticle[];
  page: number;
  activeIndex: number;
  totalAvailable: number;
  loading: boolean;
  error: string | null;
  isFavorite: boolean;
  canPrevious: boolean;
  canNext: boolean;
  onRetry: () => void;
  onToggleFavorite: (article: NewsArticle) => void;
  onFirst: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSelect: (index: number) => void;
}

function formatDate(date: string): string {
  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(parsed);
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export default function HeadlinesList({
  mode,
  heading,
  subtitle,
  article,
  articlesOnPage,
  page,
  activeIndex,
  totalAvailable,
  loading,
  error,
  isFavorite,
  canPrevious,
  canNext,
  onRetry,
  onToggleFavorite,
  onFirst,
  onPrevious,
  onNext,
  onSelect
}: HeadlinesListProps) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [article?.uuid, article?.image_url]);

  const externalArticleUrl = safeExternalUrl(
    article?.url
  );

  const originalImage = safeExternalUrl(
    article?.image_url
  );

  const imageSource =
    !imageFailed && originalImage
      ? originalImage
      : "/placeholder.png";

  const absoluteArticleNumber =
    (page - 1) * PAGE_SIZE + activeIndex + 1;

  const disablePager = loading || Boolean(error);

  return (
    <section
      className="reader"
      aria-label={
        mode === "favorites"
          ? "Saved articles"
          : "News article reader"
      }
    >
      <div className="reader-heading">
        <div className="reader-heading-copy">
          <p className="eyebrow">
            {mode === "favorites"
              ? "YOUR PERSONAL COLLECTION"
              : "THE DAILY EDIT"}
          </p>

          <h1>{heading}</h1>
          <p className="reader-subtitle">{subtitle}</p>
        </div>

        <div className="feed-label">
          <span
            className={
              mode === "live"
                ? "feed-indicator"
                : "feed-indicator saved-indicator"
            }
          />

          {mode === "live"
            ? "LIVE NEWS FEED"
            : "YOUR FAVORITES"}
        </div>
      </div>

      <div
        className="reader-stage"
        aria-live="polite"
        aria-busy={loading}
      >
        {error ? (
          <div className="message-panel" role="alert">
            <div
              className="message-symbol"
              aria-hidden="true"
            >
              !
            </div>

            <h2>Unable to load stories</h2>
            <p>{error}</p>

            <button
              type="button"
              className="primary-button"
              onClick={onRetry}
            >
              Try Again
              <span aria-hidden="true">↗</span>
            </button>
          </div>
        ) : loading ? (
          <div
            className="featured-skeleton"
            role="status"
            aria-label="Loading news articles"
          >
            <div className="skeleton-content">
              <div className="skeleton-line skeleton-small" />
              <div className="skeleton-line skeleton-title" />
              <div className="skeleton-line skeleton-title short" />
              <div className="skeleton-line skeleton-paragraph" />
              <div className="skeleton-line skeleton-paragraph short" />
              <div className="skeleton-line skeleton-button" />
            </div>

            <span className="sr-only">
              Loading articles, please wait.
            </span>
          </div>
        ) : !article ? (
          <div className="message-panel">
            <div
              className="message-symbol"
              aria-hidden="true"
            >
              ✦
            </div>

            <h2>
              {mode === "favorites"
                ? "No favorites yet"
                : "No stories found"}
            </h2>

            <p>
              {mode === "favorites"
                ? "Save an interesting article from your live feed and it will appear here."
                : "Try a different category or search for another topic."}
            </p>
          </div>
        ) : (
          <article
            className="featured-card"
            aria-labelledby="featured-title"
          >
            <img
              className="featured-image"
              src={imageSource}
              alt={
                originalImage && !imageFailed
                  ? `Image accompanying: ${article.title}`
                  : "Abstract editorial illustration"
              }
              loading="eager"
              decoding="async"
              onError={() => setImageFailed(true)}
            />

            <div
              className="image-gradient"
              aria-hidden="true"
            />

            <div className="card-topline">
              <span className="story-tag">
                <span className="story-tag-dot" />
                FEATURED STORY
              </span>

              <span className="card-counter">
                {String(absoluteArticleNumber).padStart(2, "0")}
                <span className="card-counter-separator">
                  /
                </span>
                {formatCount(totalAvailable)}
              </span>
            </div>

            <div className="featured-overlay">
              <div className="article-kicker">
                <span>
                  {article.categories?.[0] || "News"}
                </span>

                <span
                  className="kicker-divider"
                  aria-hidden="true"
                >
                  /
                </span>

                <span className="article-source">
                  {article.source || "News source"}
                </span>
              </div>

              <h2 id="featured-title">
                {article.title}
              </h2>

              <p className="article-description">
                {article.description ||
                  article.snippet ||
                  "Discover the complete story from the original publisher."}
              </p>

              <div className="article-bottom">
                <div className="article-details">
                  <span className="detail-caption">
                    PUBLISHED
                  </span>

                  <time dateTime={article.published_at}>
                    {formatDate(article.published_at)}
                  </time>
                </div>

                <div className="article-actions">
                  <button
                    type="button"
                    className={
                      isFavorite
                        ? "favorite-action is-saved"
                        : "favorite-action"
                    }
                    aria-pressed={isFavorite}
                    onClick={() =>
                      onToggleFavorite(article)
                    }
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill={
                        isFavorite
                          ? "currentColor"
                          : "none"
                      }
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path
                        d="M6 3.75h12a1 1 0 0 1 1 1V21l-7-4.5L5 21V4.75a1 1 0 0 1 1-1Z"
                      />
                    </svg>

                    {isFavorite
                      ? "Saved"
                      : "Save to Favorites"}
                  </button>

                  {externalArticleUrl && (
                    <a
                      className="read-article-button"
                      href={externalArticleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View Full Article
                      <span aria-hidden="true">
                        ↗
                      </span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          </article>
        )}
      </div>

      <nav
        className="article-navigation"
        aria-label="Article pagination"
      >
        <div className="navigation-note">
          <span className="navigation-note-line" />
          BROWSE STORIES
        </div>

        <div className="pagination-controls">
          <button
            type="button"
            className="pagination-arrow"
            onClick={onFirst}
            disabled={disablePager || !canPrevious}
            aria-label="Go to first article"
            title="First article"
          >
            «
          </button>

          <button
            type="button"
            className="pagination-arrow"
            onClick={onPrevious}
            disabled={disablePager || !canPrevious}
            aria-label="Previous article"
            title="Previous article"
          >
            ‹
          </button>

          <div
            className="pagination-dots"
            role="group"
            aria-label="Articles on current page"
          >
            {articlesOnPage.map((item, index) => {
              const absoluteNumber =
                (page - 1) * PAGE_SIZE + index + 1;

              const selected =
                index === activeIndex;

              return (
                <button
                  type="button"
                  key={item.uuid}
                  className={
                    selected
                      ? "page-dot active"
                      : "page-dot"
                  }
                  disabled={disablePager}
                  aria-label={
                    `Go to article ${absoluteNumber}`
                  }
                  aria-current={
                    selected ? "true" : undefined
                  }
                  title={
                    `Article ${absoluteNumber}: ${item.title}`
                  }
                  onClick={() => onSelect(index)}
                >
                  <span className="page-dot-number">
                    {absoluteNumber}
                  </span>
                  <span className="page-dot-marker" />
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className="pagination-arrow"
            onClick={onNext}
            disabled={disablePager || !canNext}
            aria-label="Next article"
            title="Next article"
          >
            ›
          </button>
        </div>

        <div className="navigation-status">
          {loading
            ? "LOADING STORIES"
            : article
              ? `PAGE ${page} · ${PAGE_SIZE} PER PAGE`
              : "NO ARTICLES"}
        </div>
      </nav>
    </section>
  );
}