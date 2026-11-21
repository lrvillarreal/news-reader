// web/src/App.tsx

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent
} from "react";

import HeadlinesList, {
  type ReaderMode
} from "./components/HeadlinesList";

import {
  CATEGORIES,
  PAGE_SIZE,
  fetchNewsPage,
  getErrorMessage,
  totalPagesFor,
  type NewsArticle,
  type NewsCategory,
  type NewsPage
} from "./lib/newsapi";

type LoadingStatus = "loading" | "ready" | "error";

interface FilterState {
  category: NewsCategory;
  search: string;
}

interface LiveView {
  key: string;
  page: number;
  index: number;
  result: NewsPage;
}

interface ReaderError {
  key: string;
  message: string;
}

const FAVORITES_KEY = "news-reader:favorites:v1";

const CATEGORY_ICONS: Record<NewsCategory, string> = {
  tech: "⌘",
  general: "◎",
  science: "✦",
  sports: "◉",
  business: "▦",
  health: "✚",
  entertainment: "★",
  politics: "▥",
  food: "♨",
  travel: "✈"
};

function categoryLabel(
  category: NewsCategory
): string {
  return (
    category.charAt(0).toUpperCase() +
    category.slice(1)
  );
}

function filterKey(filter: FilterState): string {
  if (filter.search) {
    return `search:${filter.search}`;
  }

  return `category:${filter.category}`;
}

function readFavorites(): NewsArticle[] {
  try {
    const saved = localStorage.getItem(FAVORITES_KEY);

    if (!saved) return [];

    const parsed: unknown = JSON.parse(saved);

    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (item): item is NewsArticle =>
        item !== null &&
        typeof item === "object" &&
        typeof item.uuid === "string" &&
        typeof item.title === "string" &&
        typeof item.url === "string"
    );
  } catch {
    return [];
  }
}

export default function App() {
  const [activeFilter, setActiveFilter] =
    useState<FilterState>({
      category: "tech",
      search: ""
    });

  const [searchInput, setSearchInput] =
    useState("");

  const [mode, setMode] =
    useState<ReaderMode>("live");

  const [mobileFiltersOpen, setMobileFiltersOpen] =
    useState(false);

  const [favorites, setFavorites] =
    useState<NewsArticle[]>(readFavorites);

  const [favoriteIndex, setFavoriteIndex] =
    useState(0);

  const [liveViewState, setLiveViewState] =
    useState<LiveView | null>(null);

  const [status, setStatus] =
    useState<LoadingStatus>("loading");

  const [switchingPage, setSwitchingPage] =
    useState(false);

  const [readerError, setReaderError] =
    useState<ReaderError | null>(null);

  const [refreshVersion, setRefreshVersion] =
    useState(0);

  // Cache pages for the current category/search.
  const pageCacheRef =
    useRef<Map<number, NewsPage>>(new Map());

  // Reuse requests already in progress.
  const inFlightRef =
    useRef<Map<number, Promise<NewsPage>>>(
      new Map()
    );

  // Prevent responses from outdated filters.
  const requestVersionRef = useRef(0);

  const controllerRef =
    useRef<AbortController | null>(null);

  const navigationBusyRef = useRef(false);

  const currentFilterKey = filterKey(activeFilter);

  const liveView =
    liveViewState?.key === currentFilterKey
      ? liveViewState
      : null;

  const activeError =
    readerError?.key === currentFilterKey
      ? readerError.message
      : null;

  // Save favorites in localStorage.
  useEffect(() => {
    try {
      localStorage.setItem(
        FAVORITES_KEY,
        JSON.stringify(favorites)
      );
    } catch {
      console.warn(
        "[news-reader] Favorites could not be persisted."
      );
    }
  }, [favorites]);

  // Keep favorites navigation within valid bounds.
  useEffect(() => {
    setFavoriteIndex((current) =>
      Math.min(
        current,
        Math.max(0, favorites.length - 1)
      )
    );
  }, [favorites.length]);

  // Fetch a page or return its cached version.
  const getOrFetchPage = useCallback(
    (
      page: number,
      filter: FilterState,
      requestVersion: number,
      signal: AbortSignal
    ): Promise<NewsPage> => {
      const cached = pageCacheRef.current.get(page);

      if (cached) {
        return Promise.resolve(cached);
      }

      const pending = inFlightRef.current.get(page);

      if (pending) {
        return pending;
      }

      const promise = fetchNewsPage(
        {
          page,
          category: filter.category,
          search: filter.search
        },
        signal
      )
        .then((result) => {
          if (
            requestVersionRef.current ===
            requestVersion
          ) {
            pageCacheRef.current.set(
              page,
              result
            );
          }

          return result;
        })
        .finally(() => {
          if (
            inFlightRef.current.get(page) ===
            promise
          ) {
            inFlightRef.current.delete(page);
          }
        });

      inFlightRef.current.set(page, promise);

      return promise;
    },
    []
  );

  // Reset news data when the category or search changes.
  useEffect(() => {
    const version = ++requestVersionRef.current;

    controllerRef.current?.abort();

    const controller = new AbortController();

    controllerRef.current = controller;

    pageCacheRef.current.clear();
    inFlightRef.current.clear();

    navigationBusyRef.current = false;

    setLiveViewState(null);
    setReaderError(null);
    setSwitchingPage(false);
    setStatus("loading");

    getOrFetchPage(
      1,
      activeFilter,
      version,
      controller.signal
    )
      .then((result) => {
        if (
          requestVersionRef.current !== version
        ) {
          return;
        }

        setLiveViewState({
          key: currentFilterKey,
          page: 1,
          index: 0,
          result
        });

        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (
          requestVersionRef.current !== version ||
          controller.signal.aborted
        ) {
          return;
        }

        setReaderError({
          key: currentFilterKey,
          message: getErrorMessage(error)
        });

        setStatus("error");
      });

    return () => {
      controller.abort();
    };
  }, [
    currentFilterKey,
    refreshVersion,
    getOrFetchPage
  ]);

  // Navigate between API result pages.
  const moveToPage = useCallback(
    async (
      targetPage: number,
      targetIndex: number
    ) => {
      if (navigationBusyRef.current) {
        return;
      }

      const version = requestVersionRef.current;

      const cached = pageCacheRef.current.get(
        targetPage
      );

      if (cached) {
        setLiveViewState({
          key: currentFilterKey,
          page: targetPage,
          index: Math.max(
            0,
            Math.min(
              targetIndex,
              cached.data.length - 1
            )
          ),
          result: cached
        });

        setReaderError(null);
        setStatus("ready");
        return;
      }

      const controller = controllerRef.current;

      if (!controller || controller.signal.aborted) {
        return;
      }

      navigationBusyRef.current = true;

      setSwitchingPage(true);
      setReaderError(null);

      try {
        const result = await getOrFetchPage(
          targetPage,
          activeFilter,
          version,
          controller.signal
        );

        if (
          requestVersionRef.current !== version
        ) {
          return;
        }

        setLiveViewState({
          key: currentFilterKey,
          page: targetPage,
          index: Math.max(
            0,
            Math.min(
              targetIndex,
              result.data.length - 1
            )
          ),
          result
        });

        setStatus("ready");
      } catch (error: unknown) {
        if (
          requestVersionRef.current !== version ||
          controller.signal.aborted
        ) {
          return;
        }

        setReaderError({
          key: currentFilterKey,
          message: getErrorMessage(error)
        });

        setStatus("error");
      } finally {
        if (
          requestVersionRef.current === version
        ) {
          navigationBusyRef.current = false;
          setSwitchingPage(false);
        }
      }
    },
    [
      activeFilter,
      currentFilterKey,
      getOrFetchPage
    ]
  );

  // Prefetch neighboring pages.
  useEffect(() => {
    if (
      mode !== "live" ||
      status !== "ready" ||
      switchingPage ||
      !liveView
    ) {
      return;
    }

    const controller = controllerRef.current;

    if (
      !controller ||
      controller.signal.aborted
    ) {
      return;
    }

    const version = requestVersionRef.current;

    const { page, index, result } = liveView;

    const totalPages = totalPagesFor(
      result.meta.found
    );

    // Prefetch the next page on the second article.
    if (index === 1 && page < totalPages) {
      void getOrFetchPage(
        page + 1,
        activeFilter,
        version,
        controller.signal
      ).catch(() => undefined);
    }

    // Prefetch previous page at the first article.
    if (index === 0 && page > 1) {
      void getOrFetchPage(
        page - 1,
        activeFilter,
        version,
        controller.signal
      ).catch(() => undefined);
    }
  }, [
    mode,
    status,
    switchingPage,
    liveView,
    activeFilter,
    getOrFetchPage
  ]);

  function selectCategory(category: NewsCategory) {
    setSearchInput("");

    setActiveFilter({
      category,
      search: ""
    });

    setMode("live");
    setMobileFiltersOpen(false);
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextFilter: FilterState = {
      category: activeFilter.category,
      search: searchInput.trim()
    };

    // Repeating an existing search refreshes results.
    if (
      filterKey(nextFilter) === currentFilterKey
    ) {
      setRefreshVersion((version) => version + 1);
    } else {
      setActiveFilter(nextFilter);
    }

    setMode("live");
    setMobileFiltersOpen(false);
  }

  function toggleFavoritesView() {
    if (mode === "favorites") {
      setMode("live");
    } else {
      setFavoriteIndex(0);
      setMode("favorites");
    }

    setMobileFiltersOpen(false);
  }

  function toggleFavorite(article: NewsArticle) {
    const exists = favorites.some(
      (item) => item.uuid === article.uuid
    );

    const updated = exists
      ? favorites.filter(
          (item) => item.uuid !== article.uuid
        )
      : [article, ...favorites];

    setFavorites(updated);

    if (mode === "favorites") {
      setFavoriteIndex((current) =>
        Math.min(
          current,
          Math.max(0, updated.length - 1)
        )
      );
    }
  }

  const liveArticles =
    liveView?.result.data ?? [];

  const liveIndex = liveView?.index ?? 0;

  const livePage = liveView?.page ?? 1;

  const liveArticle =
    liveArticles[liveIndex] ?? null;

  const liveTotal =
    liveView?.result.meta.found ?? 0;

  const liveHasPrevious = Boolean(
    liveView &&
    (liveIndex > 0 || livePage > 1)
  );

  const liveHasNext = Boolean(
    liveView &&
    liveArticles.length > 0 &&
    (
      liveIndex < liveArticles.length - 1 ||
      livePage < totalPagesFor(liveTotal)
    )
  );

  const favoritePage =
    Math.floor(favoriteIndex / PAGE_SIZE) + 1;

  const favoritePageStart =
    (favoritePage - 1) * PAGE_SIZE;

  const favoritePageArticles = favorites.slice(
    favoritePageStart,
    favoritePageStart + PAGE_SIZE
  );

  const favoriteArticle =
    favorites[favoriteIndex] ?? null;

  const showingFavorites = mode === "favorites";

  const visibleArticles = showingFavorites
    ? favoritePageArticles
    : liveArticles;

  const visibleArticle = showingFavorites
    ? favoriteArticle
    : liveArticle;

  const visiblePage = showingFavorites
    ? favoritePage
    : livePage;

  const visibleIndex = showingFavorites
    ? favoriteIndex % PAGE_SIZE
    : liveIndex;

  const visibleTotal = showingFavorites
    ? favorites.length
    : liveTotal;

  const loading =
    !showingFavorites &&
    (
      switchingPage ||
      status === "loading" ||
      (!liveView && status !== "error")
    );

  const error = showingFavorites
    ? null
    : activeError;

  const canPrevious = showingFavorites
    ? favoriteIndex > 0
    : liveHasPrevious;

  const canNext = showingFavorites
    ? favoriteIndex < favorites.length - 1
    : liveHasNext;

  const savedCurrentArticle = Boolean(
    visibleArticle &&
    favorites.some(
      (item) =>
        item.uuid === visibleArticle.uuid
    )
  );

  const readerHeading = showingFavorites
    ? "Your Favorites"
    : activeFilter.search
      ? "Search Results"
      : `${categoryLabel(activeFilter.category)} News`;

  const readerSubtitle = showingFavorites
    ? "The stories you saved, always one click away."
    : activeFilter.search
      ? `Discover stories matching "${activeFilter.search}".`
      : "Fresh perspectives. One story at a time.";

  function goToFirst() {
    if (showingFavorites) {
      setFavoriteIndex(0);
      return;
    }

    if (!liveView || switchingPage) return;

    if (livePage === 1) {
      setLiveViewState({
        ...liveView,
        index: 0
      });
    } else {
      void moveToPage(1, 0);
    }
  }

  function goToPrevious() {
    if (showingFavorites) {
      setFavoriteIndex((current) =>
        Math.max(0, current - 1)
      );
      return;
    }

    if (!liveView || switchingPage) return;

    if (liveIndex > 0) {
      setLiveViewState({
        ...liveView,
        index: liveIndex - 1
      });
    } else if (livePage > 1) {
      // Infinity selects the last article in the
      // previous page after that page has loaded.
      void moveToPage(
        livePage - 1,
        Number.POSITIVE_INFINITY
      );
    }
  }

  function goToNext() {
    if (showingFavorites) {
      setFavoriteIndex((current) =>
        Math.min(
          favorites.length - 1,
          current + 1
        )
      );
      return;
    }

    if (!liveView || switchingPage) return;

    if (liveIndex < liveArticles.length - 1) {
      setLiveViewState({
        ...liveView,
        index: liveIndex + 1
      });
    } else if (liveHasNext) {
      void moveToPage(livePage + 1, 0);
    }
  }

  function selectArticle(index: number) {
    if (showingFavorites) {
      const absoluteIndex =
        favoritePageStart + index;

      if (absoluteIndex < favorites.length) {
        setFavoriteIndex(absoluteIndex);
      }

      return;
    }

    if (
      !liveView ||
      switchingPage ||
      index < 0 ||
      index >= liveArticles.length
    ) {
      return;
    }

    setLiveViewState({
      ...liveView,
      index
    });
  }

  const today = new Intl.DateTimeFormat(
    "en-US",
    {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric"
    }
  ).format(new Date());

  return (
    <div className="app-shell">
      <aside
        id="news-filters"
        className={
          mobileFiltersOpen
            ? "sidebar filters-open"
            : "sidebar"
        }
        aria-label="News filters and navigation"
      >
        <div className="sidebar-top">
          <div className="brand">
            <div
              className="brand-symbol"
              aria-hidden="true"
            >
              N<span>.</span>
            </div>

            <div className="brand-copy">
              <span className="brand-name">
                NEWS<span>READER</span>
              </span>

              <span className="brand-caption">
                STORIES WORTH YOUR TIME
              </span>
            </div>
          </div>

          <div className="sidebar-rule" />

          <form
            className="search-section"
            role="search"
            onSubmit={submitSearch}
          >
            <label
              className="sidebar-label"
              htmlFor="news-search"
            >
              SEARCH STORIES
            </label>

            <div className="search-box">
              <svg
                viewBox="0 0 24 24"
                width="19"
                height="19"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <circle
                  cx="10.8"
                  cy="10.8"
                  r="6.8"
                />
                <path d="m16 16 4.3 4.3" />
              </svg>

              <input
                id="news-search"
                type="search"
                value={searchInput}
                maxLength={200}
                placeholder="Search the world..."
                onChange={(event) =>
                  setSearchInput(event.target.value)
                }
              />

              <button
                type="submit"
                className="search-submit"
                title="Search news"
                aria-label="Search news"
              >
                ↗
              </button>
            </div>
          </form>

          <div className="category-section">
            <div className="section-label-row">
              <span className="sidebar-label">
                EXPLORE TOPICS
              </span>

              <span className="section-label-count">
                {String(
                  CATEGORIES.length
                ).padStart(2, "0")}
              </span>
            </div>

            <nav
              className="category-navigation"
              aria-label="News categories"
            >
              {CATEGORIES.map((category) => {
                const selected =
                  !showingFavorites &&
                  !activeFilter.search &&
                  activeFilter.category === category;

                return (
                  <button
                    type="button"
                    key={category}
                    className={
                      selected
                        ? "category-button selected"
                        : "category-button"
                    }
                    aria-current={
                      selected
                        ? "page"
                        : undefined
                    }
                    onClick={() =>
                      selectCategory(category)
                    }
                  >
                    <span
                      className="category-icon"
                      aria-hidden="true"
                    >
                      {CATEGORY_ICONS[category]}
                    </span>

                    <span>
                      {categoryLabel(category)}
                    </span>

                    {selected && (
                      <span
                        className="category-active-marker"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        <div className="sidebar-bottom">
          <button
            type="button"
            className={
              showingFavorites
                ? "favorites-navigation selected"
                : "favorites-navigation"
            }
            onClick={toggleFavoritesView}
            aria-pressed={showingFavorites}
          >
            <span
              className="favorites-symbol"
              aria-hidden="true"
            >
              ☆
            </span>

            <span>
              {showingFavorites
                ? "Back to Live News"
                : "Favorites"}
            </span>

            <span className="favorites-count">
              {favorites.length}
            </span>
          </button>

          <div className="sidebar-footer">
            <span>POWERED BY THENEWSAPI</span>
            <span>BUILT FOR THE CURIOUS.</span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button
            type="button"
            className="mobile-filters-toggle"
            aria-expanded={mobileFiltersOpen}
            aria-controls="news-filters"
            onClick={() =>
              setMobileFiltersOpen((open) => !open)
            }
          >
            <span aria-hidden="true">
              ☰
            </span>

            {mobileFiltersOpen
              ? "Hide Filters"
              : "Show Filters"}
          </button>

          <div className="topbar-edition">
            <span className="topbar-accent" />

            INDEPENDENT PERSPECTIVES
            <span className="topbar-divider">
              /
            </span>
            ENGLISH EDITION
          </div>

          <span className="topbar-date">
            {today}
          </span>
        </header>

        <div className="main-reader-container">
          <HeadlinesList
            mode={mode}
            heading={readerHeading}
            subtitle={readerSubtitle}
            article={visibleArticle}
            articlesOnPage={visibleArticles}
            page={visiblePage}
            activeIndex={visibleIndex}
            totalAvailable={visibleTotal}
            loading={loading}
            error={error}
            isFavorite={savedCurrentArticle}
            canPrevious={canPrevious}
            canNext={canNext}
            onRetry={() =>
              setRefreshVersion(
                (version) => version + 1
              )
            }
            onToggleFavorite={toggleFavorite}
            onFirst={goToFirst}
            onPrevious={goToPrevious}
            onNext={goToNext}
            onSelect={selectArticle}
          />
        </div>
      </main>
    </div>
  );
}