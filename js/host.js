var SHAPES=['\u25b2','\u25c6','\u25cf','\u25a0'];
var currentGamePin=null,currentQuizData=null,currentQuestionIndex=0,timerInterval=null,timerValue=0,playerCount=0,totalPlayers=0;

function showScreen(id){document.querySelectorAll('.screen').forEach(function(s){s.classList.add('hidden')});document.getElementById(id).classList.remove('hidden')}

window.addEventListener('DOMContentLoaded',function(){loadQuizSelect()});

function loadQuizSelect(){
  var sel=document.getElementById('quiz-select'),btn=document.getElementById('btn-create-game');
  db.ref('quizzes').once('value',function(snap){
    var q=snap.val();
    sel.innerHTML='<option value="">-- Select a quiz --</option>';
    if(!q){sel.innerHTML='<option value="">No quizzes found</option>';return;}
    Object.keys(q).forEach(function(id){
      var o=document.createElement('option');o.value=id;
      var c=q[id].questions?q[id].questions.length:0;
      o.textContent=q[id].title+' ('+c+' questions)';sel.appendChild(o);
    });
  });
  sel.addEventListener('change',function(){btn.disabled=!sel.value;});
}

function createGame(){
  var qid=document.getElementById('quiz-select').value;if(!qid)return;
  db.ref('quizzes/'+qid).once('value',function(snap){
    currentQuizData=snap.val();
    if(!currentQuizData||!currentQuizData.questions){alert('Error loading quiz.');return;}
    generateUniquePin(function(pin){
      currentGamePin=pin;currentQuestionIndex=0;
      db.ref('games/'+pin).set({quizId:qid,status:'lobby',currentQuestion:0,questionStartTime:0,totalQuestions:currentQuizData.questions.length}).then(function(){showLobby(pin);});
    });
  });
}

function generateUniquePin(cb){
  var pin=String(Math.floor(100000+Math.random()*900000));
  db.ref('games/'+pin).once('value',function(s){if(s.exists())generateUniquePin(cb);else cb(pin);});
}

function showLobby(pin){
  showScreen('screen-lobby');
  document.getElementById('lobby-pin').textContent=pin;
  var qrEl=document.getElementById('qr-code');qrEl.innerHTML='';
  var playUrl=window.location.href.replace('host.html','play.html')+'?pin='+pin;
  new QRCode(qrEl,{text:playUrl,width:180,height:180,colorDark:'#1a1a1a',colorLight:'#ffffff'});
  playerCount=0;
  var listEl=document.getElementById('player-list'),countEl=document.getElementById('player-count'),startBtn=document.getElementById('btn-start-game');
  db.ref('games/'+pin+'/players').on('child_added',function(snap){
    var p=snap.val();playerCount++;
    var chip=document.createElement('div');chip.className='player-chip';chip.textContent=p.name;listEl.appendChild(chip);
    countEl.textContent=playerCount+' player'+(playerCount!==1?'s':'');
    startBtn.disabled=false;
  });
}

function startGame(){
  totalPlayers=playerCount;
  db.ref('games/'+currentGamePin).update({status:'question',currentQuestion:0}).then(function(){showQuestion(0);});
}

function showQuestion(index){
  currentQuestionIndex=index;
  var q=currentQuizData.questions[index];
  showScreen('screen-question');
  document.getElementById('q-counter').textContent='Question '+(index+1)+' of '+currentQuizData.questions.length;
  document.getElementById('q-text').textContent=q.text;
  var grid=document.getElementById('q-answers');grid.innerHTML='';
  q.options.forEach(function(opt,i){
    var block=document.createElement('div');block.className='answer-block ans-'+i;
    if(opt&&opt.trim()){block.innerHTML='<span class="ans-text">'+escapeHtml(opt)+'</span>';}
    else{block.innerHTML='<span class="shape">'+SHAPES[i]+'</span>';}
    grid.appendChild(block);
  });
  document.getElementById('answers-received').textContent='0 of '+totalPlayers+' answered';
  var startTime=Date.now();
  db.ref('games/'+currentGamePin).update({currentQuestion:index,questionStartTime:startTime,status:'question'});
  listenForAnswers(index);startTimer(q.timeLimit);
}

function listenForAnswers(qIndex){
  db.ref('games/'+currentGamePin+'/players').on('value',function(snap){
    var players=snap.val();if(!players)return;
    var count=0;
    Object.values(players).forEach(function(p){if(p.answers&&p.answers[qIndex]!==undefined)count++;});
    document.getElementById('answers-received').textContent=count+' of '+totalPlayers+' answered';
    if(count>=totalPlayers&&timerInterval){clearInterval(timerInterval);timerInterval=null;showResults();}
  });
}

function startTimer(seconds){
  if(timerInterval)clearInterval(timerInterval);
  timerValue=seconds;
  var circle=document.getElementById('timer-circle');circle.textContent=timerValue;circle.classList.remove('urgent');
  timerInterval=setInterval(function(){
    timerValue--;circle.textContent=timerValue;
    if(timerValue<=5)circle.classList.add('urgent');
    if(timerValue<=0){clearInterval(timerInterval);timerInterval=null;showResults();}
  },1000);
}

function showResults(){
  db.ref('games/'+currentGamePin+'/players').off('value');
  var q=currentQuizData.questions[currentQuestionIndex];
  db.ref('games/'+currentGamePin).update({status:'results'});
  showScreen('screen-results');
  document.getElementById('r-counter').textContent='Question '+(currentQuestionIndex+1)+' of '+currentQuizData.questions.length;
  document.getElementById('r-text').textContent=q.text;
  var grid=document.getElementById('r-answers');grid.innerHTML='';
  q.options.forEach(function(opt,i){
    var block=document.createElement('div');block.className='answer-block ans-'+i+(i===q.correct?' correct-highlight':' dimmed');
    if(opt&&opt.trim()){block.innerHTML='<span class="ans-text">'+escapeHtml(opt)+'</span>';}
    else{block.innerHTML='<span class="shape">'+SHAPES[i]+'</span>';}
    grid.appendChild(block);
  });
  db.ref('games/'+currentGamePin+'/players').once('value',function(snap){
    var players=snap.val()||{},dist=[0,0,0,0],total=0;
    Object.values(players).forEach(function(p){
      if(p.answers&&p.answers[currentQuestionIndex]!==undefined){
        var a=p.answers[currentQuestionIndex].answer;if(a>=0&&a<=3){dist[a]++;total++;}
      }
    });
    var distEl=document.getElementById('r-distribution');distEl.innerHTML='';
    for(var i=0;i<4;i++){
      var pct=total>0?Math.round((dist[i]/total)*100):0;
      distEl.innerHTML+='<div class="dist-bar-container"><div class="dist-bar-label">'+SHAPES[i]+'</div><div class="dist-bar-track"><div class="dist-bar-fill ans-'+i+'" style="width:'+pct+'%">'+( pct>10?pct+'%':'')+'</div></div><div class="dist-count">'+dist[i]+(i===q.correct?' \u2713':'')+'</div></div>';
    }
  });
}

function showLeaderboard(){
  var q=currentQuizData.questions[currentQuestionIndex];
  db.ref('games/'+currentGamePin+'/players').once('value',function(snap){
    var players=snap.val()||{},updates={};
    Object.keys(players).forEach(function(pid){
      var p=players[pid],score=p.score||0;
      if(p.answers&&p.answers[currentQuestionIndex]!==undefined){
        var ad=p.answers[currentQuestionIndex];
        if(ad.answer===q.correct){
          var ts=ad.timeTaken/1000;score+=Math.max(500,Math.round(1000*(1-ts/q.timeLimit)));
        }
      }
      updates[pid+'/score']=score;
    });
    db.ref('games/'+currentGamePin+'/players').update(updates).then(function(){
      db.ref('games/'+currentGamePin).update({status:'leaderboard'});displayLeaderboard();
    });
  });
}

function displayLeaderboard(){
  showScreen('screen-leaderboard');
  db.ref('games/'+currentGamePin+'/players').once('value',function(snap){
    var players=snap.val()||{};
    var sorted=Object.entries(players).map(function(e){return{id:e[0],name:e[1].name,score:e[1].score||0}}).sort(function(a,b){return b.score-a.score});
    var list=document.getElementById('lb-list');list.innerHTML='';
    sorted.slice(0,5).forEach(function(p,idx){
      var li=document.createElement('li');li.className='leaderboard-item';li.style.animationDelay=(idx*0.1)+'s';
      li.innerHTML='<span class="lb-rank">'+(idx+1)+'</span><span class="lb-name">'+escapeHtml(p.name)+'</span><span class="lb-score">'+p.score.toLocaleString()+'</span>';
      list.appendChild(li);
    });
    var nextBtn=document.getElementById('btn-next');
    nextBtn.textContent=currentQuestionIndex>=currentQuizData.questions.length-1?'\uD83C\uDFC6 Show Final Results':'Next Question \u2192';
  });
}

function nextQuestion(){
  if(currentQuestionIndex>=currentQuizData.questions.length-1)showPodium();
  else showQuestion(currentQuestionIndex+1);
}

function showPodium(){
  db.ref('games/'+currentGamePin).update({status:'finished'});
  showScreen('screen-podium');
  db.ref('games/'+currentGamePin+'/players').once('value',function(snap){
    var players=snap.val()||{};
    var sorted=Object.entries(players).map(function(e){return{id:e[0],name:e[1].name,score:e[1].score||0}}).sort(function(a,b){return b.score-a.score});
    var podiumEl=document.getElementById('podium');podiumEl.innerHTML='';
    var order=[1,0,2],medals=['\uD83E\uDD47','\uD83E\uDD48','\uD83E\uDD49'],cls=['podium-2nd','podium-1st','podium-3rd'];
    order.forEach(function(rank,li){
      if(sorted[rank]){
        var p=sorted[rank],div=document.createElement('div');div.className='podium-place '+cls[li];div.style.animationDelay=(li*0.2)+'s';
        div.innerHTML='<div class="place-name">'+escapeHtml(p.name)+'</div><div class="place-score">'+p.score.toLocaleString()+' pts</div><div class="podium-bar">'+medals[rank]+'</div>';
        podiumEl.appendChild(div);
      }
    });
    var table=document.getElementById('full-results');
    var html='<thead><tr><th>Rank</th><th>Name</th><th>Score</th></tr></thead><tbody>';
    sorted.forEach(function(p,idx){html+='<tr><td>'+(idx+1)+'</td><td>'+escapeHtml(p.name)+'</td><td>'+p.score.toLocaleString()+'</td></tr>';});
    html+='</tbody>';table.innerHTML=html;
  });
}

window.addEventListener('beforeunload',function(){if(currentGamePin)db.ref('games/'+currentGamePin).remove();});

function escapeHtml(s){if(!s)return '';var d=document.createElement('div');d.textContent=s;return d.innerHTML;}
