// =============================================================================
// Author:  Joey Jaikaran
// Date:    August 20, 2026
// Purpose: Handles the watched movies page of the Movie Club app. Fetches all
//          watched movies and their ratings from the backend, builds and renders
//          movie cards with aggregate and individual member ratings, and handles
//          the rating modal for submitting and editing ratings. Also handles
//          movie deletion for admin users.
// =============================================================================

// check user is logged in, and if not then redirect to index page, parse the JSON string stored in session storage into a javascript object
const user = JSON.parse(sessionStorage.getItem('user'));

if (!user)
    window.location.href = 'index.html';

// display username in nav
document.getElementById('nav-username').textContent = user.username;

// load movie list and next movie night banner when page loads
document.addEventListener('DOMContentLoaded', () => {
    loadMovieNightBanner();
    loadMovies();
});

function escapeQuotes(str) {
    return str ? str.replace(/'/g, "\\'") : '';
}

async function loadMovies() {
    try {
        // use promise.all so both tasks fire at the same time instead of one after the other. Promise.all takes an array of promises to perform, and returns an array of the results, and use array detructuring to map the results in array to variables in the same, variables need to be in same order as results for mapping to work correctly
        const [ moviesRes, ratingsMap ] = await Promise.all([
            fetch(`${API_URL}/api/movies`),
            loadAllRatings()
        ]);

        // take the JSON string from the response body and parse into JavaScript object, in this case an array of movie objects
        const movies = await moviesRes.json();

        const container = document.getElementById('movies-container');

        // if no movies have been added yet then populate container appropriately
        if (movies.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No movies watched yet</p>
                    <p>Add your first movie on the Next Movie page</p>
                </div>
            `;
            return;
        }

        // go through list of movies, get the ratings mapped to that movie, create a movie card using movie and ratings and add card to container
        container.innerHTML = '';
        movies.forEach(movie => {
            const ratings = ratingsMap[movie.id] || [];
            container.appendChild(createMovieCard(movie, ratings));
        });
    }
    catch (error) {
        document.getElementById('movies-container').innerHTML = `
            <div class="empty-state">
                <p>Could not load movies</p>
                <p>Make sure the server is running</p>
            </div>
        `;
    }
}

async function loadAllRatings() {
    try {
        const moviesRes = await fetch(`${API_URL}/api/movies`);
        const movies = await moviesRes.json();

        const ratingsMap = {};

        // use .map to loop through movies array, we transform each value into a promise and that promise involves fetching all ratings for that movie, parsing ratings in a ratings object, and then adding ratings object to ratings map at movie id key, so then we have an arry of these promises. that array of promises gets passes to promise.all which resolves all the promises simultaneously, so at the end we have a fully populated ratings map
        // we dont store the result of promise.all into variables here like we did before because we dont need to use the values anywhere, all we care about is that the map gets populated
        await Promise.all(movies.map(async movie => {
            const res = await fetch(`${API_URL}/api/movies/${movie.id}/ratings`);
            const ratings = await res.json();
            ratingsMap[movie.id] = ratings;
        }));

        return ratingsMap;
    }
    catch (error) {
        return {};
    }
}

function createMovieCard(movie, ratings) {
    const card = document.createElement('div');
    card.classList.add('movie-card');

    // see if user has left a rating for specified movie
    const userRating = ratings.find(r => r.userId === user.id);
    // calculate aggregate rating across all submitted ratings, check first to ensure at least one rating has been submitted
    const aggregateRating = ratings.length > 0
        ? (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1)
        : 'No ratings yet';

    const posterUrl = movie.posterUrl
        ? `https://image.tmdb.org/t/p/w500${movie.posterUrl}`
        : 'https://via.placeholder.com/500x750?text=No+Poster';

    // create movie card using html
    card.innerHTML = `
        <img src="${posterUrl}" alt="${movie.title}">
        <div class="movie-card-body">
            <div class="movie-card-title">${movie.title}</div>
            <div class="movie-card-meta">
                ${movie.year} • Chosen by ${movie.chosenByUsername} • 
                ${new Date(movie.dateWatched).toLocaleDateString()}
            </div>
            <div class="movie-card-rating">
                ⭐ ${aggregateRating}
            </div>
            <div class="ratings-list">
                ${renderRatingsList(ratings)}
            </div>
            <button class="btn-secondary" style="margin-top: 0.75rem; width: 100%"
                    onclick="openRatingModal(${movie.id}, '${escapeQuotes(movie.title)}', ${userRating ? userRating.rating : null})">
                ${userRating ? 'Edit Rating' : 'Rate'}
            </button>
            ${user.username === 'Joey' ? `
                <button class="btn-danger" style="margin-top: 0.5rem; width: 100%"
                        onclick="deleteMovie(${movie.id})">
                    Delete
                </button>
            ` : ''}
        </div>
    `;

    return card;
}

function renderRatingsList(ratings) {
    if (ratings.length === 0)
        return '<div class="rating-item"><span>No ratings yet</span></div>';

    return ratings.map(r => `
            <div class="rating-item">
                <span>${r.username}</span>
                <span class="rating-value">${r.rating}</span>
            </div>
        `).join('');    // .join() combines ratings into one string
}

let currentMovieId = null;

function openRatingModal(movieId, movieTitle, existingRating) {
    currentMovieId = movieId;
    document.getElementById('modal-movie-title').textContent = movieTitle;
    document.getElementById('modal-rating-input').value = existingRating || '';
    document.getElementById('modal-rating-input').placeholder = existingRating ? existingRating : 'e.g. 8.5';
    document.getElementById('rating-modal').classList.remove('hidden');
    document.getElementById('modal-rating-input').focus();
}

function closeRatingModal() {
    document.getElementById('rating-modal').classList.add('hidden');
    document.getElementById('modal-rating-input').value = '';
    currentMovieId = null;
}

async function confirmRating() {
    // get current value in rating and store in variable
    const input = document.getElementById(`modal-rating-input`);
    // value from an input is a string so convert to float
    const rating = parseFloat(input.value);

    // safety check
    if (isNaN(rating) || rating < 0 || rating > 10) {
        alert('Please enter a rating between 0 and 10');
        return;
    }

    // round rating to one decimal place
    const rounded = Math.round(rating * 10) / 10;

    try {
        const response = await fetch(`${API_URL}/api/ratings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                movieId: currentMovieId,
                userId: user.id,
                rating: rounded
            })
        });

        if (!response.ok) {
            const data = await response.json();
            alert(data.error || 'Failed to save rating');
            return;
        }

        closeRatingModal();
        loadMovies();
    }
    catch (error) {
        alert('Could not connect to server');
    }
}

// close modal when clicking outside
document.getElementById('rating-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('rating-modal')) {
        closeRatingModal();
    }
})

async function deleteMovie(movieId) {
    if (!confirm('Are you sure you want to delete this movie?')) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/movies/${movieId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const data = await response.json();
            alert(data.error || 'Failed to delete movie');
            return;
        }

        loadMovies();
    }
    catch (error) {
        alert('Could not connect to server');
    }
}