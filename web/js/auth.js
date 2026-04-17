// 🔐 LOGIN
async function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    const res = await fetch("https://cognito-idp.ap-south-1.amazonaws.com/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth",
      },
      body: JSON.stringify({
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
        },
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: window.APP_CONFIG.CLIENT_ID,
      }),
    });

    const data = await res.json();

    if (data.AuthenticationResult) {
      const { IdToken, RefreshToken, AccessToken } = data.AuthenticationResult;

      // ✅ Store ALL tokens
      localStorage.setItem("idToken", IdToken);
      localStorage.setItem("refreshToken", RefreshToken);
      localStorage.setItem("accessToken", AccessToken);

      const accessPayload = JSON.parse(atob(AccessToken.split(".")[1]));
      const groups = accessPayload['cognito:groups'] || [];
      const isAdmin = Array.isArray(groups) ? groups.includes('admin') : false;

      // Redirect based on role
      window.location.href = isAdmin ? "/admin.html" : "/index.html";
    } else {
      alert(data.message || "Login failed");
      console.log(data);
    }
  } catch (err) {
    alert("Login error");
    console.error(err);
  }
}

// 🔄 REFRESH TOKEN
async function refreshToken() {
  const refreshToken = localStorage.getItem("refreshToken");

  if (!refreshToken) return;

  try {
    const res = await fetch("https://cognito-idp.ap-south-1.amazonaws.com/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth",
      },
      body: JSON.stringify({
        AuthFlow: "REFRESH_TOKEN_AUTH",
        ClientId: window.APP_CONFIG.CLIENT_ID,
        AuthParameters: {
          REFRESH_TOKEN: refreshToken,
        },
      }),
    });

    const data = await res.json();

    if (data.AuthenticationResult) {
      // ✅ Update BOTH tokens
      localStorage.setItem("idToken", data.AuthenticationResult.IdToken);
      localStorage.setItem(
        "accessToken",
        data.AuthenticationResult.AccessToken,
      );
    } else {
      logout();
    }
  } catch (err) {
    console.error("Refresh error", err);
    logout();
  }
}

// 🚪 LOGOUT
function logout() {
  localStorage.clear();
  window.location.href = "/login.html";
}

// ⏳ TOKEN EXPIRY CHECK
function isTokenExpired(token) {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

// 🚫 PROTECT PAGES
(function protectRoute() {
  const path = window.location.pathname;

  // Skip login page
  if (path.includes("login.html")) return;

  const token = localStorage.getItem("idToken");

  if (!token || isTokenExpired(token)) {
    logout();
  }
})();

// 🔁 AUTO REFRESH EVERY 50 MIN
setInterval(refreshToken, 50 * 60 * 1000);

// ⌨️ ENTER KEY LOGIN (only on login page)
if (window.location.pathname.includes("login.html")) {
  document.addEventListener("keypress", function (e) {
    if (e.key === "Enter") login();
  });
}
