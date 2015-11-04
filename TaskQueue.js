'use strict';

let TaskQueue=module.exports={};
let mx=require('os').cpus().length;

// get a simple taskqueue
TaskQueue.createSimple=(options)=>new(function(){
  fx(options=options||{},{maxCount:mx*100 });
  let c=0,q=[],m=options.maxCount;
  let n=()=>{
    while(1){
      if(c>=m || !q.length)return;
      q.shift()(()=>{--c;n();});
      ++c;
    }
  };
  this.push=(h)=>(q.push(h),n());
  this.hasTask=()=>q.length+c;
  this.currentTask=()=>c;
});

// state code of task
TaskQueue.UNKNOWN=0; // this task is not defined
TaskQueue.SLEEPING=1; // this task is in the queue, but not actived
TaskQueue.RUNNING=2;
TaskQueue.COMPLETED=3;

// use more memeory but support completed jobs
TaskQueue.create=(options)=>new(function(options){

  // default options
  fx(options=options||{},{
    maxCount: mx*100 ,
    disabled: false,
    destoryIfNoTask: false
  });

  let tasks={}; // place the attributes fo task: id,state,result,tq(`tq` will always set as null unless this is a child taskqueue)
  let callbacks={}; // callbacks of tasks. taskid:{id,fn}
  let addCallback=(taskId,id,fn)=>{
    let x=callbacks[taskId]||{};
    x[id]=fn;
    callbacks[taskId]=x;
    cleanCallback(taskId);
  };
  let cleanCallback=(taskId)=>{
    let t=tasks[taskId]||{},c=callbacks[taskId]||{};
    if(t.state ^ TaskQueue.COMPLETED)return;
    for(let q in c)c[q].apply({},t.result),delete(c[q]);
  };
  let queue=[],currentCount=0;

  // run next task
  let _nextTick=()=>{
    if(options.disabled || this.isDestoried)return false;
    if(options.destoryIfNoTask && !this.hasTask()){
      this.destory();
      return false;
    }
    if(!queue.length || currentCount>=options.maxCount)return false;
    currentCount++;
    let fq=queue.shift();
    let taskId=fq[0],fn=fq[1];
    let task=tasks[taskId]={ state:1, id:taskId, result:void 0, tq:null };
    task.state=TaskQueue.RUNNING;
    if(typeof fn==='function'){
      fn((...r)=>{
        currentCount--;
        task.state=TaskQueue.COMPLETED;
        task.result=r;
        cleanCallback(taskId);
        this.reportResult.apply({},r);
        nextTick();
      },(taskId)=>{
        let o=tasks[taskId]||{state:0};
        o.addCallback=(id,callback)=>addCallback.apply({},[taskId].concat(
          fixArgs([String,Function],[id,callback],[getId(),()=>{}]))
        ),o.removeCallback=(id)=>delete(callbacks[taskId][id]);
        return o;
      },this);
    }else{
      fn.reportResult=(...r)=>{
        task.state=TaskQueue.RUNNING;
        task.result=r;
      };
      fn.destoried=()=>{
        currentCount--;
        task.state=TaskQueue.COMPLETED;
        task.tq=null;
        cleanCallback(taskId);
        nextTick();
      };
      task.tq=fn;
      // run the child taskqueue
      fn.run && fn.run(); 
      fn.isDestoried && fn.destory();
    }
    return true;
  },nextTick=()=>setTimeout(()=>{
     while(_nextTick()===true);
  },0);

  this.isDestoried=false;

  // for normal task
  ((p)=>{
    this.push=(id,fn)=>(queue.push(p(id,fn)),nextTick(),this);
    this.unshift=(id,fn)=>(queue.unshift(p(id,fn)),nextTick(),this);
  })((id,fn)=>fixArgs([String,[Function,Object]],[id,fn],[getId()]));
  // for child taskqueue
  ((p)=>{
    this.pushQueue=(id,options,handler)=>
      p('push',id,options,handler);
    this.unshiftQueue=(id,options,handler)=>
      p('unshift',id,options,handler);
  })((t,id,options,handler)=>{
    let r=fixArgs(
      [String,Object,Function],
      [id,options,handler],
      [getId(),{},()=>{}]);
    id=r[0],options=r[1],handler=r[2];
    options.disabled=true;
    let cq=TaskQueue.create(options);
    this[t](id,cq);
    handler(cq);
    return cq;
  });

  // child taskqueue will NOT run until it has got the running chance from parent
  if(options.disabled)this.run=()=>{
    options.disabled=false;
    delete this.run;
    nextTick();
  };
  this.destory=()=>{
    this.isDestoried=true;
    for(let i in tasks)
      tasks[i].tq && tasks[i].tq.destory();
    this.destoried();
    queue=[];
    tasks={};
    currentCount=0;
    nextTick();
  };
  this.hasTask=()=>currentCount+queue.length;
  this.currentTask=()=>currentCount;

  // `reportResult` and `destoried` are used for child taskqueues
  // child taskqueue can report the result to their parent by `reportResult`
  this.reportResult=
  // when chlid taskqueue destoring, parent taskqueue will do something by `destoried` 
  this.destoried=
  ()=>{};
});

// unique id
let i=0,getId=()=>[i++,Math.random()].join(',');

let fx=(r,d)=>{
  for(let k in d)
    if(!r.hasOwnProperty(k))
      r[k]=d[k];
};

let fixArgs=(t,r,d)=>{
  d=d||[];
  r.map((c)=>{
    for(let i=0;i<t.length;i++){
      if(t[i].prototype!==undefined)
        t[i]=[t[i]];
      for(let x=t[i],j=0;j<x.length;j++)if(
        (x[j]===String && c+''===c) ||
        (x[j]===Function && typeof c==='function') ||
        (x[j]===Array && c instanceof Array) || 
        (x[j]===Object && typeof(c)==='object' && c instanceof Array===false)
      ){d[i]=c;break;}
    }
  });
  return d;
};

