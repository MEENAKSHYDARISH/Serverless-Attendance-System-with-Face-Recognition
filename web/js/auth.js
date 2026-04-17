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

    // 🟡 NEW PASSWORD FLOW
    if (data.ChallengeName === "NEW_PASSWORD_REQUIRED") {
      let newPassword;

      while (true) {
        newPassword = prompt(
          "Set new password (Min 8 chars, 1 uppercase, 1 number):",
        );

<<<<<<< HEAD
      const parseJwt = (token) => {
        try {
          return JSON.parse(atob(token.split(".")[1]));
        } catch {
          return {};
        }
      };

      const accessPayload = parseJwt(AccessToken);
      const idPayload = parseJwt(IdToken);
      const groups = accessPayload['cognito:groups'] || idPayload['cognito:groups'] || [];
      const isAdmin = Array.isArray(groups) ? groups.includes('admin') : String(groups).split(',').includes('admin');

      // Redirect based on role
      window.location.href = isAdmin ? "/admin.html" : "/index.html";
=======
        if (!newPassword) return;

        const valid =
          newPassword.length >= 8 &&
          /[A-Z]/.test(newPassword) &&
          /[0-9]/.test(newPassword);

        if (valid) break;

        alert("Weak password!");
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

      if (challengeData.AuthenticationResult) {
        handleLoginSuccess(challengeData.AuthenticationResult);
      } else {
        alert("Failed to set new password");
      }
    }

    // 🟢 NORMAL LOGIN
    else if (data.AuthenticationResult) {
      handleLoginSuccess(data.AuthenticationResult);
>>>>>>> dddbd99 (Admin dashboard fully working)
    } else {
      alert("Login failed");
      console.log(data);
    }
  } catch (err) {
    console.error(err);
    alert("Login error");
  }
}

// 🎯 COMMON LOGIN SUCCESS HANDLER
function handleLoginSuccess(authResult) {
  const { IdToken, RefreshToken, AccessToken } = authResult;

  localStorage.setItem("idToken", IdToken);
  localStorage.setItem("refreshToken", RefreshToken);
  localStorage.setItem("accessToken", AccessToken);

  const payload = JSON.parse(atob(IdToken.split(".")[1]));
  const groups = payload["cognito:groups"] || [];

  if (groups.includes("admin")) {
    window.location.href = "/admin.html";
  } else {
    window.location.href = "/index.html";
  }
}

// 🔄 REFRESH TOKEN
async function refreshToken() {
  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken) return;

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
    localStorage.setItem("idToken", data.AuthenticationResult.IdToken);
    localStorage.setItem("accessToken", data.AuthenticationResult.AccessToken);
  } else {
    logout();
  }
}

// 🚪 LOGOUT
function logout() {
  localStorage.clear();
  window.location.href = "/login.html";
}

// ⏳ CHECK TOKEN
function isTokenExpired(token) {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

// 🔐 PROTECT ONLY ADMIN PAGE
(function protectRoute() {
  const path = window.location.pathname;

  if (path.includes("admin.html")) {
    const token = localStorage.getItem("idToken");
    if (!token || isTokenExpired(token)) {
      logout();
    }
  }
})();
