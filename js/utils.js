const API_URL = 'https://movie-club-backend.onrender.com';

async function loadMovieNightBanner() {
    try {
        const res = await fetch(`${API_URL}/api/settings/movie-night`);
        const data = await res.json();

        if (!data.date) return;

        // store date for next movie night and current date in variables
        const movieNight = new Date(data.date + 'T00:00:00');
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // calculate the time diffence between current day and next movie night and display to user
        const diffTime = movieNight - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        let message = '';
        if (diffDays < 0)
            message = `Last movie night was ${Math.abs(diffDays)} days ago`;
        else if (diffDays == 0)
           message =  `🎬 Movie night is TODAY!`;
        else if (diffDays == 1)
            message = `🎬 Movie night is TOMORROW!`;
        else 
            message = `🎬 Next movie night: ${movieNight.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} — ${diffDays} days away`;

        // create banner element to display movie night countdown
        const banner = document.createElement('div');
        banner.id = 'movie-night-banner';
        banner.textContent = message;
        banner.style.cssText = `
            background-color: var(--bg-card);
            border-bottom: 1px solid var(--border);
            padding: 0.6rem 2rem;
            text-align: center;
            font-size: 0.85rem;
            color: var(--accent);
            letter-spacing: 0.03em;
        `;

        const nav = document.querySelector('nav');
        nav.insertAdjacentElement('afterend', banner);
    }
    catch (error) {
        console.error('Could not load movie night date:', error);
    }
}

function openPinModal() {
    document.getElementById('new-pin-input').value = '';
    document.getElementById('confirm-pin-input').value = '';
    document.getElementById('pin-modal').classList.remove('hidden');
    document.getElementById('new-pin-input').focus();
}

function closePinModal() {
    document.getElementById('pin-modal').classList.add('hidden');
    document.getElementById('new-pin-input').value = '';
    document.getElementById('confirm-pin-input').value = '';
}

async function submitPinChange() {
    const newPin = document.getElementById('new-pin-input').value;
    const confirmPin = document.getElementById('confirm-pin-input').value;

    // safety check to ensure user is submitting a valid pin
    if (!newPin || newPin.length < 4) {
        alert('PIN must be at least 4 digits');
        return;
    }

    if (!/^\d+$/.test(newPin)) {
        alert('PIN must be numeric only');
        return;
    }

    if (newPin !== confirmPin) {
        alert('PINs do not match');
        return;
    }

    try {
        const user = JSON.parse(sessionStorage.getItem('user'));
        // make post request to database updating new PIN
        const res = await fetch(`${API_URL}/api/auth/update-pin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: user.id,
                newPin: newPin
            })
        });

        // display result of request to user
        if (!res.ok) {
            const data = await res.json();
            alert(data.error || 'Could not update PIN');
            return;
        }

        closePinModal();
        alert('PIN updated successfully');
    }
    catch (error) {
        alert('Could not connect to server');
    }
}

// close pin modal when clicking outside
document.addEventListener('click', (e) => {
    const modal = document.getElementById('pin-modal');
    if (modal && e.target === modal) {
        closePinModal();
    }
});