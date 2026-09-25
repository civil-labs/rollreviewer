1. The frontend requests a resource via an API call to the [[Backend for Frontend]], with the browser automatically attaching the HttpOnly session cookie if it is present
2. The session is expired or non-existent, so the backend returns a 401 error to the frontend
3. The frontend fetch handler captures that 401 error, and then triggers logic that tells the user's browser to redirect to the auth endpoint of the backend
4. The backend, which stores the OIDC config, dynamically constructs an auth request to the idP using the app's client_id and the backend's own auth endpoint as the redirect URL
5. The backend returns the frontend's redirect call to its auth endpoint with a 307 http error and the Location header set to the constructed auth request
6. The browser sees that is redirected to the URL in the Location header
7. The user logs in
8. The IdP redirects the browser to the redirect URL of the app, which was set to the auth route on the backend's API
9. The backend will take the [[Authorization Code]] in the code query parameter, and swap it for a token through a backend call to the auth server's token endpoint using its client credentials
10. The BFF stores those tokens either in memory or to an external store, keying them to a random session ID that it generates for this user session
11. The BFF sends the session ID back to the frontend in a Set-Cookie header like `Set-Cookie: session=xyz123; HttpOnly; Secure; SameSite=Lax; Path=/` to keep the session in an [[HttpOnly Cookie]]
12. When the frontend makes future requests, the session ID will be sent with those requests by the browser. The backend will use that session ID to find the user’s tokens and validate the request. If no session can be found with that ID, there is no session ID, or the access token is invalid and can’t be refreshed, then the BFF should return a 401 error to the frontend to prompt it to restart this process

If the frontend later needs the actual auth token for some reason, utilize the [[Token Mediating and Session Information Backend For Frontend]] spec.