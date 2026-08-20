// =============================================================================
// Author:  Joey Jaikaran
// Date:    August 20, 2026
// Purpose: Handles the rankings page of the Movie Club app. Fetches all rated
//          movies from the backend and displays them sorted by aggregate rating
//          from highest to lowest. Also calculates and displays member rankings
//          based on the average aggregate rating of each member's movie picks.
// =============================================================================

const user = JSON.parse(sessionStorage.getItem('user'));
if (!user) window.location.href = 'index.html';

document.getElementById('nav-username').textContent = user.username;

document.addEventListener('DOMContentLoaded', () => {
    loadMovieNightBanner();
    loadRankings();
});

async function loadRankings() {
    try {
        const [moviesRes, ratingsRes] = await Promise.all([
            fetch(`${API_URL}/api/movies/ranked`),
            fetch(`${API_URL}/api/movies`)
        ]);

        const movies = await moviesRes.json();
        const allMovies = await ratingsRes.json();

        const container = document.getElementById('rankings-container');

        if (movies.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No rankings yet</p>
                    <p>Rate some movies on the Watched page to see rankings</p>
                </div>
            `;
            return;
        }

        // go through movies list and transform each element into a promise that retrieve all ratings for that movie and add them to the ratings map at the movie id, promise.all will resolve all these promises so you end up with a fully populated ratings map
        const ratingsMap = {};
        await Promise.all(allMovies.map(async movie => {
            const res = await fetch(`${API_URL}/api/movies/${movie.id}/ratings`);
            const ratings = await res.json();
            ratingsMap[movie.id] = ratings;
        }));

        container.innerHTML = '';
        movies.forEach((movie, index) => {
            const ratings = ratingsMap[movie.id] || [];
            container.appendChild(createRankingItem(movie, ratings, index + 1));
        });

        const memberRankings = buildMemberRankings(allMovies, ratingsMap);
        if (memberRankings.length > 0)
            container.appendChild(renderMemberRankings(memberRankings));
    }
    catch (error) {
        document.getElementById('rankings-container').innerHTML = `
            <div class="empty-state">
                <p>Could not load rankings</p>
                <p>Make sure the server is running</p>
            </div>
        `;
    }
}

function buildMemberRankings(movies, ratingsMap) {
    const memberScores = {};

    movies.forEach(movie => {
        const ratings = ratingsMap[movie.id] || [];
        if (ratings.length === 0) return;

        const aggregate = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;

        // check memberScores object to see if member has already been added or not, if they havent then add them to object with username as key and defauly values of 0
        if ( !memberScores[movie.chosenByUsername]) {
            memberScores[movie.chosenByUsername] = {
                username: movie.chosenByUsername,
                totalScore: 0,
                movieCount: 0
            };
        }

        // add the aggregate rating score to the total score for the user that chose this movie, and increase their movie chosen count
        memberScores[movie.chosenByUsername].totalScore += aggregate;
        memberScores[movie.chosenByUsername].movieCount += 1;
    });

    // create an array with just he values from the member scores object, then use map to transform each element in the array into an object that contains username, average score, and movie count, and then sort the array of new objects by average score descending, return the array
        return Object.values(memberScores)
            .map(member => ({
                username: member.username,
                avgScore: (member.totalScore / member.movieCount).toFixed(2),
                movieCount: member.movieCount
            }))
            .sort((a,b) => b.avgScore - a.avgScore);
}

function renderMemberRankings(members) {
    const section = document.createElement('div');
    section.style.marginTop = '3rem';

    section.innerHTML = `
        <div class="page-header">
            <h1>Member Rankings</h1>
            <p>Members ranked by average score of their movie picks</p>
        </div>
        <div class="rankings-list">
            ${members.map((member, index) => `
                <div class="ranking-item">
                    <div class="ranking-number">#${index + 1}</div>
                    <div class="ranking-info">
                        <div class="ranking-title">${member.username}</div>
                        <div class="ranking-meta">${member.movieCount} movie${member.movieCount !== 1 ? 's' : ''} chosen</div>
                    </div>
                    <div class="ranking-score">⭐ ${member.avgScore}</div>
                </div>
            `).join('')}
        </div>
    `;

    return section;
}

function createRankingItem(movie, ratings, rank) {
    const item = document.createElement('div');
    item.classList.add('ranking-item');

    const posterUrl = movie.posterUrl
        ? `https://image.tmdb.org/t/p/w500${movie.posterUrl}`
        : 'https://via.placeholder.com/500x750?text=No+Poster';

    const aggregateRating = ratings.length > 0
        ? (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1)
        : 'N/A';

    item.innerHTML = `
        <div class="ranking-number">#${rank}</div>
        <img src="${posterUrl}" alt="${movie.title}">
        <div class="ranking-info">
            <div class="ranking-title">${movie.title}</div>
            <div class="ranking-meta">
                ${movie.year} • Chosen by ${movie.chosenByUsername}
            </div>
            <div class="ratings-list" style="margin-top: 0.5rem;">
                ${renderRatingsList(ratings)}
            </div>
        </div>
        <div class="ranking-score">⭐ ${aggregateRating}</div>
    `;

    return item;
}

function renderRatingsList(ratings) {
    if (ratings.length === 0)
        return '<div class="rating-item"><span>No ratings yet</span></div>';

    return ratings.map(r => `
        <div class="rating-item">
            <span>${r.username}</span>
            <span class="rating-value">${r.rating}</span>
        </div>
    `).join('');
}