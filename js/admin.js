var ADMIN_PASSWORD='jcr2026';
var SHAPES=['\u25b2','\u25c6','\u25cf','\u25a0'];
var COLORS=['Red','Blue','Yellow','Green'];
var questionCounter=0;

function attemptLogin(){
  var inp=document.getElementById('password-input');
  var err=document.getElementById('login-error');
  if(inp.value===ADMIN_PASSWORD){
    document.getElementById('login-overlay').classList.add('hidden');
    document.getElementById('admin-main').classList.remove('hidden');
    loadQuizzes();
  }else{
    err.textContent='Incorrect password.';
    err.classList.remove('hidden');
    inp.value='';inp.focus();
  }
}

document.getElementById('password-input').addEventListener('keydown',function(e){if(e.key==='Enter')attemptLogin();});

function loadQuizzes(){
  var el=document.getElementById('quiz-list');
  db.ref('quizzes').on('value',function(snap){
    var q=snap.val();
    if(!q){el.innerHTML='<p style="color:#999;text-align:center">No quizzes yet.</p>';return;}
    var h='';
    Object.keys(q).forEach(function(id){
      var d=q[id],c=d.questions?d.questions.length:0;
      h+='<div class="quiz-list-item"><div class="quiz-info"><div class="quiz-name">'+escapeHtml(d.title)+'</div>';
      h+='<div class="quiz-count">'+c+' question'+(c!==1?'s':'')+'</div></div>';
      h+='<div class="quiz-actions">';
      h+='<button class="btn btn-blue btn-sm" onclick="editQuiz(\''+id+'\')">Edit</button>';
      h+='<button class="btn btn-danger btn-sm" onclick="deleteQuiz(\''+id+'\')">Delete</button>';
      h+='</div></div>';
    });
    el.innerHTML=h;
  });
}

function showEditor(qid){
  document.getElementById('quiz-list-section').classList.add('hidden');
  document.getElementById('quiz-editor').classList.remove('hidden');
  document.getElementById('edit-quiz-id').value=qid||'';
  document.getElementById('quiz-title').value='';
  document.getElementById('questions-container').innerHTML='';
  questionCounter=0;
  if(!qid){document.getElementById('editor-title').textContent='New Quiz';addQuestionCard();}
  else{document.getElementById('editor-title').textContent='Edit Quiz';}
}

function cancelEditor(){
  document.getElementById('quiz-editor').classList.add('hidden');
  document.getElementById('quiz-list-section').classList.remove('hidden');
}

function addQuestionCard(data){
  questionCounter++;
  var n=questionCounter,ct=document.getElementById('questions-container'),card=document.createElement('div');
  card.className='question-card';
  var t=data?data.text:'',opts=data?data.options:['','','',''],cor=data?data.correct:-1,tl=data?data.timeLimit:20;
  var oh='';
  for(var i=0;i<4;i++){
    oh+='<div class="option-row"><span style="font-size:1.2rem;width:24px;text-align:center">'+SHAPES[i]+'</span>';
    oh+='<input type="text" class="opt-input" placeholder="Option '+(i+1)+' ('+COLORS[i]+')" value="'+escapeHtml(opts[i])+'">';
    oh+='<input type="radio" name="correct-'+n+'" value="'+i+'"'+(cor===i?' checked':'')+'><label>Correct</label></div>';
  }
  card.innerHTML='<button class="remove-q-btn" onclick="removeQuestionCard(this)">&times;</button>';
  card.innerHTML+='<h4>Question <span class="q-number">'+n+'</span></h4>';
  card.innerHTML+='<div class="form-group"><input type="text" class="q-text-input" placeholder="Enter your question" value="'+escapeHtml(t)+'"></div>';
  card.innerHTML+=oh;
  card.innerHTML+='<div class="form-group" style="margin-top:12px"><label>Time Limit</label><select class="time-select">';
  card.innerHTML+='<option value="10"'+(tl===10?' selected':'')+'>10s</option>';
  card.innerHTML+='<option value="20"'+(tl===20?' selected':'')+'>20s</option>';
  card.innerHTML+='<option value="30"'+(tl===30?' selected':'')+'>30s</option></select></div>';
  ct.appendChild(card);
}

function removeQuestionCard(btn){
  btn.closest('.question-card').remove();
  var cards=document.querySelectorAll('.question-card');
  cards.forEach(function(c,i){c.querySelector('.q-number').textContent=i+1;});
  questionCounter=cards.length;
}

function saveQuiz(){
  var title=document.getElementById('quiz-title').value.trim();
  if(!title){alert('Please enter a quiz title.');return;}
  var cards=document.querySelectorAll('.question-card');
  if(cards.length===0){alert('Add at least one question.');return;}
  var questions=[],valid=true;
  cards.forEach(function(card,idx){
    if(!valid)return;
    var text=card.querySelector('.q-text-input').value.trim();
    var optInputs=card.querySelectorAll('.opt-input');
    var options=Array.from(optInputs).map(function(inp){return inp.value.trim();});
    var radios=card.querySelectorAll('input[type="radio"]');
    var timeLimit=parseInt(card.querySelector('.time-select').value);
    var correct=-1;
    radios.forEach(function(r){if(r.checked)correct=parseInt(r.value);});
    if(!text){alert('Q'+(idx+1)+': Enter question text.');valid=false;return;}
    for(var i=0;i<4;i++){if(!options[i]){alert('Q'+(idx+1)+': Fill all 4 options.');valid=false;return;}}
    if(correct===-1){alert('Q'+(idx+1)+': Select correct answer.');valid=false;return;}
    questions.push({text:text,options:options,correct:correct,timeLimit:timeLimit});
  });
  if(!valid)return;
  var data={title:title,questions:questions,createdAt:firebase.database.ServerValue.TIMESTAMP};
  var eid=document.getElementById('edit-quiz-id').value;
  if(eid){db.ref('quizzes/'+eid).update(data).then(function(){alert('Quiz updated!');cancelEditor();});}
  else{db.ref('quizzes').push(data).then(function(){alert('Quiz created!');cancelEditor();});}
}

function editQuiz(id){
  db.ref('quizzes/'+id).once('value',function(snap){
    var quiz=snap.val();if(!quiz){alert('Quiz not found.');return;}
    showEditor(id);
    document.getElementById('quiz-title').value=quiz.title;
    document.getElementById('questions-container').innerHTML='';
    questionCounter=0;
    if(quiz.questions)quiz.questions.forEach(function(q){addQuestionCard(q);});
  });
}

function deleteQuiz(id){
  if(confirm('Delete this quiz?'))db.ref('quizzes/'+id).remove().then(function(){alert('Deleted.');});
}

function escapeHtml(s){
  if(!s)return '';
  var d=document.createElement('div');d.textContent=s;return d.innerHTML;
}
