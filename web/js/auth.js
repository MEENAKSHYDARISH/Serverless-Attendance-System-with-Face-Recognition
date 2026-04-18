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
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: window.APP_CONFIG.CLIENT_ID,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
        },
      }),
    });

    const data = await res.json();
    console.log("LOGIN RESPONSE:", data);

    // 🟡 NEW PASSWORD REQUIRED FLOW
    if (data.ChallengeName === "NEW_PASSWORD_REQUIRED") {
      let newPassword;

      while (true) {
        newPassword = prompt(
          "Set new password (Min 8 chars, 1 uppercase, 1 number):",
        );

        if (!newPassword) return;

        const valid =
          newPassword.length >= 8 &&
          /[A-Z]/.test(newPassword) &&
          /[0-9]/.test(newPassword);

        if (valid) break;

        alert("Weak password! Try again.");
      }

      const challengeRes = await fetch(
        "https://cognito-idp.ap-south-1.amazonaws.com/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-amz-json-1.1",
            "X-Amz-Target":
              "AWSCognitoIdentityProviderService.RespondToAuthChallenge",
          },
          body: JSON.stringify({
            ChallengeName: "NEW_PASSWORD_REQUIRED",
            ClientId: window.APP_CONFIG.CLIENT_ID,
            Session: data.Session,
            ChallengeResponses: {
              USERNAME: email,
              NEW_PASSWORD: newPassword,
            },
          }),
        },
      );

      const challengeData = await challengeRes.json();
      console.log("CHALLENGE RESPONSE:", challengeData);

      if (challengeData.AuthenticationResult) {
        handleLoginSuccess(challengeData.AuthenticationResult);
      } else {
        alert("Failed to set new password");
      }

      return;
    }

    // 🟢 NORMAL LOGIN FLOW
    if (data.AuthenticationResult) {
      handleLoginSuccess(data.AuthenticationResult);
    } else {
      alert("Login failed");
      console.log("ERROR:", data);
    }
  } catch (err) {
    console.error(err);
    alert("Login error");
  }
}

// 🎯 LOGIN SUCCESS HANDLER
function handleLoginSuccess(authResult) {
  const { IdToken, RefreshToken, AccessToken } = authResult;

  if (!IdToken) {
    alert("Login failed: missing token");
    return;
  }

  localStorage.setItem("idToken", IdToken);
  localStorage.setItem("refreshToken", RefreshToken);
  localStorage.setItem("accessToken", AccessToken);

  const payload = JSON.parse(atob(IdToken.split(".")[1]));

  const rawGroups = payload["cognito:groups"];

  const groups = Array.isArray(rawGroups)
    ? rawGroups
    : typeof rawGroups === "string"
      ? rawGroups.split(",")
      : [];

  const isAdmin = groups.includes("admin");

  window.location.href = isAdmin ? "/admin.html" : "/index.html";
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

    if (data.AuthenticationResult && data.AuthenticationResult.IdToken) {
      localStorage.setItem("idToken", data.AuthenticationResult.IdToken);
      localStorage.setItem(
        "accessToken",
        data.AuthenticationResult.AccessToken,
      );
    } else {
      console.warn("Refresh failed:", data);
      logout();
    }
  } catch (err) {
    console.error("Refresh error:", err);
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

// 🔐 PROTECT ADMIN ROUTE
(function protectRoute() {
  const path = window.location.pathname;

  if (path.includes("admin.html")) {
    const token = localStorage.getItem("idToken");

    if (!token || isTokenExpired(token)) {
      logout();
    }
  }
})();
