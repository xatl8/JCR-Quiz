const firebaseConfig = {
  apiKey: "AIzaSyC1JM6TAIHTeGEh0IS4iVt57e1KDyhM62U",
  authDomain: "jcr-quiz.firebaseapp.com",
  databaseURL: "https://jcr-quiz-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "jcr-quiz",
  storageBucket: "jcr-quiz.firebasestorage.app",
  messagingSenderId: "743753783745",
  appId: "1:743753783745:web:aff7d1f3bf6b2ebea8f740"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
