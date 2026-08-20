// =============================================================================
// Author:  Joey Jaikaran
// Date:    August 20, 2026
// Purpose: Handles the next movie page of the Movie Club app. Determines the
//          current picker from the database and displays their name. Shows a
//          TMDB movie search bar to the current picker so they can add up to
//          three suggestions. Displays all current suggestions with seen it
//          voting counts, and allows the current picker to mark a movie as
//          watched or delete a suggestion. Marking as watched moves the movie
//          to the watched list, clears all suggestions, and advances the pick
//          order to the next member.
// =============================================================================

// TMDB API key - low risk public key for movie search only
const TMDB_API_KEY = 'c45a8ae27aaf47c1a4b7a2ae8b2dced6';
const TMDB_BASE = 'https://api.themoviedb.org/3';

const user = JSON.parse(sessionStorage.getItem('user'));
if (!user) window.location.href = 'index.html';

document.getElementById('nav-username').textContent = user.username;

const PICK_ORDER = ['Aaron', 'Alex', 'Jamie', 'Joey', 'Kevin'];

document.addEventListener('DOMContentLoaded', () => {
    loadMovieNightBanner();
    init();
});

async function init() {
    const currentPicker = await getCurrentPicker();
    document.getElementById('picker-name').textContent = currentPicker;

    // only show the search bar to make suggestions and date selector to the current picker
    if (currentPicker === user.username) {
        document.getElementById('search-section').classList.remove('hidden');
        document.getElementById('movie-night-section').classList.remove('hidden');
        setupSearch();
    }

    loadSuggestions();
}

async function getCurrentPicker() {
    try {
        const res = await fetch(`${API_URL}/api/settings/current-picker`);
        const data = await res.json();

        return PICK_ORDER[data.index];
    }
    catch (error) {
        return 'Unknown';
    }
}

function setupSearch() {
    const searchInput = document.getElementById('movie-search');
    const searchResults = document.getElementById('search-results');
    let searchTimeout = null;

    // add listener to search input that will fire everytime the value in the input changes (input event)
    searchInput.addEventListener('input', () => {
        // cancel the function call if user types again, this way it only fires once the user has finished typing for 400 milliseconds, not just after every interaction
        clearTimeout(searchTimeout);

        //use current input as query, but do not show query results until user has typed at least 2 letters so reults are not too large
        const query = searchInput.value.trim();

        if (query.length < 2) {
            searchResults.classList.add('hidden');
            return;
        }

        // call the search movies function after 400 milliseconds using what the user has typed
        searchTimeout = setTimeout(() => searchMovies(query), 400);
    });

    // have search results list disappear when user clicks off search
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target))
            searchResults.classList.add('hidden');
    });
}

async function searchMovies(query) {
    try {
        const res = await fetch(
            `${TMDB_BASE}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=en-US&page=1`
        );
        const data = await res.json();
        // only show first 6 results
        renderSearchResults(data.results.slice(0,6));
    }
    catch (error) {
        console.error('Search failed:', error);
    }
}

function renderSearchResults(results) {
    const container = document.getElementById('search-results');

    // if no result found from search then report to user
    if (results.length === 0) {
        container.innerHTML = '<div style="padding: 1rem; color: var(--text-muted)">No results found</div>';
        container.classList.remove('hidden');
        return;
    }

    // show results list from search to user
    container.innerHTML = results.map(movie => `
        <div class="search-result-item" onclick="selectMovie(${movie.id}, '${escapeQuotes(movie.title)}', '${movie.poster_path || ''}', ${movie.release_date ? movie.release_date.substring(0, 4) : 0})">
            <img src="${movie.poster_path
                ? `https://image.tmdb.org/t/p/w92${movie.poster_path}`
                : 'https://via.placeholder.com/36x54?text=?'}"
                alt="${escapeQuotes(movie.title)}">
            <div class="result-info">
                <div class="result-title">${movie.title}</div>
                <div class="result-year">${movie.release_date ? movie.release_date.substring(0, 4) : 'Unknown'}</div>
            </div>
        </div>
    `).join('');

    container.classList.remove('hidden');
}

function escapeQuotes(str) {
    // normalize movie titles to remove single apostrophes in movie titles that will cause program to think string ends prematurely
    return str ? str.replace(/'/g, "\\'") : '';
}

async function selectMovie(tmdbId, title, posterPath, year) {
    document.getElementById('search-results').classList.add('hidden');
    document.getElementById('movie-search').value = '';

    try {
        const res = await fetch(`${API_URL}/api/suggestions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tmdbId,
                title,
                posterUrl: posterPath,
                year,
                suggestedBy: user.id
            })
        });

        const data = await res.json();

        // check reponse to see if added to database successfully, if it was then load suggestions to user, if not then report error to user
        if (!res.ok) {
            alert(data.error || 'Could not add suggestion');
            return;
        }

        loadSuggestions();
    }
    catch (error) {
        alert('Could not connect to server');
    }
}

async function loadSuggestions() {
    try {
        const res = await fetch(`${API_URL}/api/suggestions`);
        const suggestions = await res.json();

        const container = document.getElementById('suggestions-container');

        // if no suggestions have been made yet then display that to user
        if (suggestions.length === 0) {
            const currentPicker = document.getElementById('picker-name').textContent;
            const isCurrentPicker = currentPicker === user.username;

            container.innerHTML = `
                <div class="empty-state">
                    <p>No suggestions yet</p>
                    ${isCurrentPicker 
                        ? '<p>Search for a movie above to add a suggestion</p>' 
                        : `<p>Waiting for ${currentPicker} to add suggestions</p>`}
                </div>
            `;
            
            return;
        }

        // fetch the seen it responses for suggested movies, store in javascript object that will make suggested movies to the associated seen it responses
        const seenItMap = {};

        await Promise.all(suggestions.map(async suggestion => {
            const res = await fetch(`${API_URL}/api/suggestions/${suggestion.id}/seen-it`);
            const seenIt = await res.json();
            seenItMap[suggestion.id] = seenIt;
        }));

        // go through every suggested movie and create a suggested movie card using the movie and the seen it responses
        container.innerHTML = '';
        suggestions.forEach(suggestion => {
            try {
                const seenIt = seenItMap[suggestion.id] || [];
                const card = createSuggestionCard(suggestion, seenIt);
                container.appendChild(card);
            } catch (error) {
                console.error('error creating card for suggestion', suggestion.id, error);
            }
        });
    }
    catch (error) {
        document.getElementById('suggestions-container').innerHTML = `
            <div class="empty-state">
                <p>Could not load suggestions</p>
            </div>
        `;
    }
}

function createSuggestionCard(suggestion, seenItResponses) {
    const card = document.createElement('div');
    card.classList.add('suggestion-card');

    const posterUrl = suggestion.posterUrl
        ? `https://image.tmdb.org/t/p/w200${suggestion.posterUrl}`
        : 'https://via.placeholder.com/80x120?text=?';

    // count how many people have seen movie and how many people have not seen movie
    const seenCount = seenItResponses.filter(r => r.hasSeen).length;
    const notSeenCount = seenItResponses.filter(r => !r.hasSeen).length;

    // find the seen it response for the current user, used to highlight what button they have already clicked
    const userResponse = seenItResponses.find(r => r.userId == user.id);
    // determine the current picker, and if the curent user is the picker as display will be differnt for the current picker as only they can make suggestions
    const currentPicker = document.getElementById('picker-name').textContent;
    const isCurrentPicker = currentPicker === user.username;

    card.innerHTML = `
        <img src="${posterUrl}" alt="${escapeQuotes(suggestion.title)}">
        <div class="suggestion-card-body">
            <div class="suggestion-title">${suggestion.title}</div>
            <div class="suggestion-meta">
                ${suggestion.year} • Suggested by ${suggestion.suggestedByUsername}
            </div>
            <div class="seen-it-counts">
                👁 ${seenCount} seen it · 🚫 ${notSeenCount} haven't seen it
            </div>
            <div class="suggestion-actions">
                <button class="btn-secondary ${userResponse && userResponse.hasSeen ? 'active-btn' : ''}"
                        onclick="toggleSeenIt(${suggestion.id}, true)">
                    Seen it
                </button>
                <button class="btn-secondary ${userResponse && !userResponse.hasSeen ? 'active-btn' : ''}"
                        onclick="toggleSeenIt(${suggestion.id}, false)">
                    Haven't seen it
                </button>
                ${isCurrentPicker ? `
                    <button class="btn-success"
                            onclick="markAsWatched(${suggestion.id})">
                        Watched
                    </button>
                    <button class="btn-danger"
                            onclick="deleteSuggestion(${suggestion.id})">
                        Delete
                    </button>
                ` : ''}
            </div>
        </div>
    `;

    return card;
}

async function toggleSeenIt(suggestionId, hasSeen) {
    try {
        // send post method to database updating whether the user has seen this suggestion or not
        const res = await fetch(`${API_URL}/api/suggestions/${suggestionId}/seen-it`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: user.id,
                hasSeen: hasSeen
            })
        });

        // if post request does not go through then report to user, if it does go through then load updated suggestions
        if (!res.ok) {
            const data = await res.json();
            alert(data.error || 'Could not save response');
            return;
        }

        loadSuggestions();
    }
    catch (error) {
        alert('Could not connect to server');
    }
}

async function markAsWatched(suggestionId) {
    // confirm with user that they want to mark as watched, if they dont confirm then just return
    if (!confirm('Mark this movie as watched? This will clear all suggestions and move to the next person\'s pick.'))
         return;

    // prompt user to enter the day the movie was watched
    const dateWatched = prompt('Enter the date watched (YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
    if (!dateWatched) return;

    try {
        // post watched movie to database
        const res = await fetch(`${API_URL}/api/suggestions/${suggestionId}/watched`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chosenBy: user.id,
                dateWatched: dateWatched
            })
        });

        // if request is not successful then repost to user, if it is successful then call loadSuggestions() to refresh suggestions (should be cleared in database by backend), and init() to cycle to next picker
        if (!res.ok) {
            const data = await res.json();
            alert(data.error || 'Could not mark as watched');
            return;
        }

        // increment picker index in database
        await fetch(`${API_URL}/api/settings/increment-picker`, { method: 'POST' });

        alert('Movie added to watched list');
        loadSuggestions();
        init();
    }
    catch (error) {
        alert('Could not connect to server');
    }
}

async function deleteSuggestion(suggestionId) {
    // have user confirm they want to delete movie first, if they do not then return
    if (!confirm('Delete this suggestion?')) return;

    try{
        const res = await fetch(`${API_URL}/api/suggestions/${suggestionId}`, {
            method: 'DELETE'
        });

        // report response to user if unsuccesful, if it is successful then load updated suggestions
        if (!res.ok) {
            const data = await res.json();
            alert(data.error || 'Could not delete suggestion');
            return;
        }

        loadSuggestions();
    }
    catch (error) {
        alert('Could not connect to server');
    }
}

async function updateMovieNight() {
    const input = document.getElementById('movie-night-input');
    const date = input.value;

    if (!date) {
        alert('Please select a date');
        return;
    }

    try {
        // post new movie night date to database
        const res = await fetch(`${API_URL}/api/settings/movie-night`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date })
        });

        // if post request does not go through then report to user
        if (!res.ok) {
            alert('Could not update movie night date');
            return;
        }

        // reload banner with new date if post request is successful
        const existingBanner = document.getElementById('movie-night-banner');
        if (existingBanner) existingBanner.remove();
        loadMovieNightBanner();
        alert('Movie night date updated');
    }
    catch (error) {
        alert('Could not connect to server');
    }
}