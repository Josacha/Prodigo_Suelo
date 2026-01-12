/*import { onAuthStateChanged }
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { auth } from "./firebase.js";

onAuthStateChanged(auth, user => {
  if (!user) location.href = "index.html";
});

