var SHAPES=['\u25b2','\u25c6','\u25cf','\u25a0'];
var gamePin=null,playerId=null,playerName=null,playerQuizData=null,currentQuestionIndex=-1,hasAnswered=false,timerInterval=null,questionStartTime=0;

function showScreen(id){document.querySelectorAll('.screen').forEach(function(s){s.classList.add('hidden')});document.getElementById(id).classList.remove('hidden')}

window.addEventListener('DOMContentLoaded',function(){
  var params=new URLSearchParams(window.location.search);
  var pin=params.get('pin');if(pin)document.getElementById('input-pin').value=pin;
  document.getElementById('input-name').addEventListener('keydown',function(e){if(e.key==='Enter')joinGame();});
  document.getElementById('input-pin').addEventListener('keydown',function(e){if(e.key==='Enter')document.getElementById('input-name').focus();});
});

function joinGame(){
  var pinInput=document.getElementById('input-pin'),nameInput=document.getElementById('input-name'),statusEl=document.getElementById('join-status');
  var pin=pinInput.value.trim(),name=nameInput.value.trim();
  if(!pin||pin.length!==6||!/^[0-9]+$/.test(pin)){showJoinError(statusEl,'Please enter a valid 6-digit Game PIN.');return;}
  if(!name){showJoinError(statusEl,'Please enter your nickname.');return;}
  var joinBtn=document.getElementById('btn-join');joinBtn.disabled=true;joinBtn.textContent='Joining...';
  db.ref('games/'+pin).once('value',function(snap){
    if(!snap.exists()){showJoinError(statusEl,'Game not found. Check the PIN.');joinBtn.disabled=false;joinBtn.textContent='Join Game';return;}
    var game=snap.val();
    if(game.status!=='lobby'){showJoinError(statusEl,'This game has already started.');joinBtn.disabled=false;joinBtn.textContent='Join Game';return;}
    gamePin=pin;playerName=name;
    var playerRef=db.ref('games/'+pin+'/players').push({name:name,score:0});
    playerId=playerRef.key;
    db.ref('quizzes/'+game.quizId).once('value',function(quizSnap){
      playerQuizData=quizSnap.val();
      document.getElementById('lobby-name').textContent=name;
      showScreen('screen-lobby');listenForGameState();
    });
  });
}

function showJoinError(el,msg){el.textContent=msg;el.classList.remove('hidden');el.style.color='#E21B3C';}

function listenForGameState(){
  db.ref('games/'+gamePin).on('value',function(snap){
    var game=snap.val();
    if(!game){alert('The host has ended the game.');window.location.href='play.html';return;}
    var status=game.status,qIndex=game.currentQuestion||0;
    switch(status){
      case 'lobby':break;
      case 'question':
        if(qIndex!==currentQuestionIndex){currentQuestionIndex=qIndex;hasAnswered=false;questionStartTime=game.questionStartTime;showPlayerQuestion(qIndex);}
        break;
      case 'results':if(timerInterval){clearInterval(timerInterval);timerInterval=null;}showFeedback(currentQuestionIndex);break;
      case 'leaderboard':updateRank();break;
      case 'finished':if(timerInterval){clearInterval(timerInterval);timerInterval=null;}showFinalScreen();break;
    }
  });
}

function showPlayerQuestion(index){
  if(!playerQuizData||!playerQuizData.questions[index])return;
  var q=playerQuizData.questions[index];
  showScreen('screen-question');
  document.body.classList.remove('flash-correct','flash-wrong');
  document.getElementById('p-q-counter').textContent='Question '+(index+1)+' of '+playerQuizData.questions.length;
  document.getElementById('p-q-text').textContent=q.text;
  var grid=document.getElementById('p-answers');grid.innerHTML='';
  q.options.forEach(function(opt,i){
    var block=document.createElement('div');block.className='answer-block ans-'+i;
    if(opt&&opt.trim()){block.innerHTML='<span class="ans-text">'+escapeHtml(opt)+'</span>';}
    else{block.innerHTML='<span class="shape">'+SHAPES[i]+'</span>';}
    block.setAttribute('onclick','submitAnswer('+i+')');
    grid.appendChild(block);
  });
  document.getElementById('p-status').classList.add('hidden');
  startLocalTimer(q.timeLimit);
}

function startLocalTimer(timeLimit){
  if(timerInterval)clearInterval(timerInterval);
  var circle=document.getElementById('p-timer');circle.classList.remove('urgent');
  var update=function(){
    var elapsed=(Date.now()-questionStartTime)/1000;
    var remaining=Math.max(0,Math.ceil(timeLimit-elapsed));
    circle.textContent=remaining;
    if(remaining<=5)circle.classList.add('urgent');
    if(remaining<=0){clearInterval(timerInterval);timerInterval=null;if(!hasAnswered)disableAnswerBlocks();}
  };
  update();timerInterval=setInterval(update,500);
}

function submitAnswer(answerIndex){
  if(hasAnswered)return;hasAnswered=true;
  var timeTaken=Date.now()-questionStartTime;
  db.ref('games/'+gamePin+'/players/'+playerId+'/answers/'+currentQuestionIndex).set({answer:answerIndex,timeTaken:timeTaken});
  var blocks=document.querySelectorAll('#p-answers .answer-block');
  blocks.forEach(function(b,i){b.classList.add('disabled');if(i===answerIndex)b.classList.add('selected');});
  var statusEl=document.getElementById('p-status');
  statusEl.textContent='\u2705 Answer submitted! Waiting for results...';
  statusEl.style.color='';statusEl.classList.remove('hidden');
}

function disableAnswerBlocks(){
  document.querySelectorAll('#p-answers .answer-block').forEach(function(b){b.classList.add('disabled');});
  var statusEl=document.getElementById('p-status');
  statusEl.textContent='\u23F0 Time\'s up!';statusEl.classList.remove('hidden');
}

function showFeedback(questionIndex){
  if(!playerQuizData||!playerQuizData.questions[questionIndex])return;
  var q=playerQuizData.questions[questionIndex];
  db.ref('games/'+gamePin+'/players/'+playerId+'/answers/'+questionIndex).once('value',function(snap){
    showScreen('screen-feedback');
    var iconEl=document.getElementById('fb-icon'),textEl=document.getElementById('fb-text'),pointsEl=document.getElementById('fb-points'),rankEl=document.getElementById('fb-rank');
    var ad=snap.val();
    if(ad&&ad.answer===q.correct){
      document.body.classList.remove('flash-wrong');document.body.classList.add('flash-correct');
      var pts=Math.max(500,Math.round(1000*(1-(ad.timeTaken/1000)/q.timeLimit)));
      iconEl.textContent='\u2705';textEl.textContent='Correct!';textEl.style.color='#26890C';pointsEl.textContent='+'+pts.toLocaleString()+' points';
    }else{
      document.body.classList.remove('flash-correct');document.body.classList.add('flash-wrong');
      iconEl.textContent='\u274C';textEl.textContent=ad?'Wrong!':'No answer!';textEl.style.color='#E21B3C';pointsEl.textContent='+0 points';
    }
    rankEl.textContent='Calculating rank...';
  });
}

function updateRank(){
  db.ref('games/'+gamePin+'/players').once('value',function(snap){
    var players=snap.val()||{};
    var sorted=Object.entries(players).map(function(e){return{id:e[0],score:e[1].score||0}}).sort(function(a,b){return b.score-a.score});
    var rank=sorted.findIndex(function(p){return p.id===playerId})+1;
    var rankEl=document.getElementById('fb-rank');
    if(rankEl)rankEl.textContent='You are #'+rank+' of '+sorted.length;
  });
}

function showFinalScreen(){
  db.ref('games/'+gamePin+'/players').once('value',function(snap){
    var players=snap.val()||{};
    var sorted=Object.entries(players).map(function(e){return{id:e[0],name:e[1].name,score:e[1].score||0}}).sort(function(a,b){return b.score-a.score});
    var rank=sorted.findIndex(function(p){return p.id===playerId})+1;
    var myData=sorted.find(function(p){return p.id===playerId});
    showScreen('screen-final');
    document.body.classList.remove('flash-correct','flash-wrong');
    document.getElementById('final-rank').textContent='#'+rank;
    document.getElementById('final-score').textContent=myData?myData.score.toLocaleString():'0';
  });
}

function escapeHtml(s){if(!s)return '';var d=document.createElement('div');d.textContent=s;return d.innerHTML;}
