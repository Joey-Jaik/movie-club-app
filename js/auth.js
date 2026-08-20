// =============================================================================
// Author:  Joey Jaikaran
// Date:    August 20, 2026
// Purpose: Handles user authentication for the Movie Club app. Validates the
//          login form, sends credentials to the backend API, stores the logged
//          in user in sessionStorage on success, and redirects to the watched
//          movies page. Also handles Enter key submission on the PIN input.
// =============================================================================

document.getElementById('login-btn').addEventListener('click', async () => {
    const username = document.getElementById('username').value;
    const pin = document.getElementById('pin').value;
    const errorMsg = document.getElementById('error-msg');

    errorMsg.classList.add('hidden');

    // if user has tried to login without entering username or pin then inform them of error
    if (!username) {
        showError('Please select your name');
        return;
    }

    if (!pin) {
        showError('Please enter your pin');
        return;
    }

    try {
        //use await so page doesnt freeze during fetch request, webpage is free to perform other tasks, it also ensures that the code doesn't continue running until the promise is resolved, so when we get to data response continues to result of the fetch request
        // post used here for security, with a get request the username and password would get passed in the url, also login is an action, and actions use post. it is an action becuase we are not simply just retrieving the user info, we are authenticating and granting access, this means that login has side effects like updating session storage, the browser now knows that someone is logged in which is a different state than before the action, this is a side effect and having side effects makes it an action. other side effects could be updating last login timestamp, logging the login event for security auditing, and starting a timeout counter.
        // header is telling server that data will be sent in JSON formatted text
        const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-type': 'application/json' },
            body: JSON.stringify({ username, pin })
        });

        // await here again as reading and parsing the reponse into a javascript object takes time
        const data = await response.json();

        // safety check
        if (!response.ok) {
            showError(data.error || 'Login failed');
            return;
        }

        // update session storage, this is a front end effect, saying that this user is logged in, and forward to the watched.html page
        sessionStorage.setItem('user', JSON.stringify(data));
        window.location.href = 'watched.html';
    }
    catch (error) {
        showError('Could not connect to server');
    }
});

document.getElementById('pin').addEventListener('keydown', (e) => {
    if (e.key === 'Enter')
        document.getElementById('login-btn').click();
});

function showError(message) {
    const errorMsg = document.getElementById('error-msg');
    errorMsg.textContent = message;
    errorMsg.classList.remove('hidden');
}