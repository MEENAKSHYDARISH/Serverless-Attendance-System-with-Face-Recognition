async function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

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
    const { IdToken, RefreshToken } = data.AuthenticationResult;

    localStorage.setItem("idToken", IdToken);
    localStorage.setItem("refreshToken", RefreshToken);

    window.location.href = "/index.html"; // redirect after login
  } else {
    alert(data.message || "Login failed");
    console.log(data);
  }
}

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
  } else {
    logout();
  }
}

function logout() {
  localStorage.clear();
  window.location.href = "/login.html";
}

function isTokenExpired(token) {
  if (!token) return true;
  const payload = JSON.parse(atob(token.split(".")[1]));
  return payload.exp * 1000 < Date.now();
}

if (window.location.pathname.includes("login.html")) {
  document.addEventListener("keypress", function (e) {
    if (e.key === "Enter") login();
  });
}
