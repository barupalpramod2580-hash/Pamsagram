// Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { 
  getAuth, 
  RecaptchaVerifier, 
  signInWithPhoneNumber, 
  onAuthStateChanged, 
  signOut 
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  doc, 
  updateDoc, 
  arrayUnion, 
  arrayRemove, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-storage.js";

// 1. Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyA3YXGCUmi8T1vNn4YF2S4FbUeM-a9NYDk",
  authDomain: "pamsa-c5339.firebaseapp.com",
  projectId: "pamsa-c5339",
  storageBucket: "pamsa-c5339.firebasestorage.app",
  messagingSenderId: "999496039627",
  appId: "1:999496039627:web:f30086099b83066d1f2f4e"
};

// Initialize Services
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// DOM Elements
const authContainer = document.getElementById("auth-container");
const appContainer = document.getElementById("app-container");
const phoneStep = document.getElementById("phone-step");
const otpStep = document.getElementById("otp-step");
const phoneNumberInput = document.getElementById("phone-number");
const otpCodeInput = document.getElementById("otp-code");
const usernameInput = document.getElementById("username-input");
const btnSendOtp = document.getElementById("btn-send-otp");
const btnVerifyOtp = document.getElementById("btn-verify-otp");
const authError = document.getElementById("auth-error");
const logoutBtn = document.getElementById("logout-btn");
const feedContainer = document.getElementById("feed-container");

// Upload Post DOM Elements
const uploadModal = document.getElementById("upload-modal");
const openUploadBtn = document.getElementById("open-upload-btn");
const closeModalBtn = document.getElementById("close-modal-btn");
const postImageFile = document.getElementById("post-image-file");
const postCaption = document.getElementById("post-caption");
const btnPublishPost = document.getElementById("btn-publish-post");

let confirmationResultTemp = null;

// ================= 1. PHONE AUTHENTICATION =================

function setupRecaptcha() {
  if (!window.recaptchaVerifier) {
    window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
      size: "invisible",
      callback: () => {}
    });
  }
}

// Send OTP
btnSendOtp.addEventListener("click", async () => {
  const phoneNumber = phoneNumberInput.value.trim();
  if (!phoneNumber) {
    authError.textContent = "Please enter a valid phone number with country code (e.g., +91).";
    return;
  }

  try {
    setupRecaptcha();
    const appVerifier = window.recaptchaVerifier;
    confirmationResultTemp = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
    
    phoneStep.classList.add("hidden");
    otpStep.classList.remove("hidden");
    authError.textContent = "";
  } catch (error) {
    authError.textContent = error.message;
  }
});

// Verify OTP
btnVerifyOtp.addEventListener("click", async () => {
  const code = otpCodeInput.value.trim();
  const username = usernameInput.value.trim() || "User";

  if (!code) {
    authError.textContent = "Please enter the 6-digit OTP.";
    return;
  }

  try {
    const result = await confirmationResultTemp.confirm(code);
    const user = result.user;
    
    // Save username locally (or sync with Firestore)
    localStorage.setItem(`user_${user.uid}`, username);
    
    authError.textContent = "";
  } catch (error) {
    authError.textContent = "Invalid OTP. Please try again.";
  }
});

// Logout
logoutBtn.addEventListener("click", () => signOut(auth));

// Auth State Observer
onAuthStateChanged(auth, (user) => {
  if (user) {
    authContainer.classList.add("hidden");
    appContainer.classList.remove("hidden");
    loadPosts();
  } else {
    authContainer.classList.remove("hidden");
    appContainer.classList.add("hidden");
    phoneStep.classList.remove("hidden");
    otpStep.classList.add("hidden");
  }
});

// ================= 2. POST UPLOAD LOGIC =================

openUploadBtn.addEventListener("click", () => uploadModal.classList.remove("hidden"));
closeModalBtn.addEventListener("click", () => uploadModal.classList.add("hidden"));

btnPublishPost.addEventListener("click", async () => {
  const file = postImageFile.files[0];
  const caption = postCaption.value.trim();
  const currentUser = auth.currentUser;

  if (!file) {
    alert("Please choose an image to upload!");
    return;
  }

  btnPublishPost.textContent = "Uploading...";
  btnPublishPost.disabled = true;

  try {
    // 1. Upload to Storage
    const storageRef = ref(storage, `posts/${Date.now()}_${file.name}`);
    const uploadResult = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(uploadResult.ref);

    const savedUsername = localStorage.getItem(`user_${currentUser.uid}`) || currentUser.phoneNumber;

    // 2. Save document to Firestore
    await addDoc(collection(db, "posts"), {
      userId: currentUser.uid,
      username: savedUsername,
      imageUrl: downloadURL,
      caption: caption,
      likes: [],
      createdAt: serverTimestamp()
    });

    uploadModal.classList.add("hidden");
    postCaption.value = "";
    postImageFile.value = "";
    loadPosts();
  } catch (err) {
    alert("Upload failed: " + err.message);
  } finally {
    btnPublishPost.textContent = "Share";
    btnPublishPost.disabled = false;
  }
});

// ================= 3. FEED & INTERACTION =================

async function loadPosts() {
  feedContainer.innerHTML = "<p style='text-align:center;'>Loading feed...</p>";
  
  try {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    feedContainer.innerHTML = "";

    if (snapshot.empty) {
      feedContainer.innerHTML = "<p style='text-align:center;'>No posts yet. Be the first to post!</p>";
      return;
    }

    snapshot.forEach((docSnapshot) => {
      const post = docSnapshot.data();
      const postId = docSnapshot.id;
      const isLiked = post.likes && post.likes.includes(auth.currentUser?.uid);

      const postEl = document.createElement("article");
      postEl.className = "post-card";
      postEl.innerHTML = `
        <div class="post-header">
          <img class="avatar" src="https://picsum.photos/40/40?random=${postId}" alt="User" />
          <span class="post-username">${post.username || "User"}</span>
        </div>
        <div class="post-image-container">
          <img src="${post.imageUrl}" alt="Post image" />
        </div>
        <div class="post-actions">
          <i class="${isLiked ? 'fa-solid liked' : 'fa-regular'} fa-heart like-btn" data-id="${postId}"></i>
          <i class="fa-regular fa-comment"></i>
          <i class="fa-regular fa-paper-plane"></i>
        </div>
        <div class="post-details">
          <div class="likes-count">${post.likes ? post.likes.length : 0} likes</div>
          <div class="caption">
            <span>${post.username || "User"}</span>${post.caption || ""}
          </div>
        </div>
      `;

      // Like interaction
      const likeBtn = postEl.querySelector(".like-btn");
      likeBtn.addEventListener("click", () => toggleLike(postId, post.likes || []));

      feedContainer.appendChild(postEl);
    });
  } catch (error) {
    feedContainer.innerHTML = `<p style='text-align:center; color:red;'>Error loading feed: ${error.message}</p>`;
  }
}

async function toggleLike(postId, likesArray) {
  const currentUserId = auth.currentUser.uid;
  const postRef = doc(db, "posts", postId);

  if (likesArray.includes(currentUserId)) {
    await updateDoc(postRef, {
      likes: arrayRemove(currentUserId)
    });
  } else {
    await updateDoc(postRef, {
      likes: arrayUnion(currentUserId)
    });
  }
  loadPosts();
}
