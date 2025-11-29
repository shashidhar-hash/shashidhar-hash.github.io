const loginForm = document.getElementById("login-form");
const loginIdInput = document.getElementById("loginId");
const passwordInput = document.getElementById("password");
const feedback = document.getElementById("feedback");

const DEMO_ACCOUNTS = {
  Shashi: "Shashi@123",
  Amar: "Amar@123",
  admin3: "admin3@123",
};

const showMessage = (message, type) => {
  feedback.textContent = message;
  feedback.className = type;
};

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const id = loginIdInput.value.trim();
  const pass = passwordInput.value;

  if (!id || !pass) {
    showMessage("Enter both fields to continue.", "error");
    return;
  }

  const isValid = DEMO_ACCOUNTS[id] === pass;

  if (isValid) {
    showMessage("Login successful! Redirecting…", "success");
    setTimeout(() => {
      window.location.href = "dashboard.html";
    }, 900);
  } else {
    showMessage("Invalid login ID or password.", "error");
  }
});

