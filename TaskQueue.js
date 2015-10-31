'use strict';

let TaskQueue=module.exports={};

// 任务状态值
TaskQueue.UNKNOWN=0; // 暂时没有这个任务id
TaskQueue.SLEEPING=1; // 存在这个任务，但是尚未执行
TaskQueue.RUNNING=2; // 正在执行中，但尚未完毕
TaskQueue.COMPLETED=3; // 已经完成

// 创建任务队列
TaskQueue.create=(options)=>new Instance(options);

//返回唯一标示
let i=0,getId=()=>[i++,Math.random()].join(',');

let fx=(r,d)=>{
  for(let k in d)
    if(!r.hasOwnProperty(k))
      r[k]=d[k];
};

// 任务队列构造器
function Instance(options){
  // 填充options缺省
  fx(options,{
    maxCount: 10,
    disabled: false,
    destoryIfNoTask: false
  });

  let tasks={}; // 存放任务相关属性：id,state,result,tq(如果是未执行完毕的任务队列，则这一项是任务队列实例，否则为null)
  let callbacks={}; // 任务完成时的回调函数：taskid:{id,fn}
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
  let queue=[],currentCount=0,currentRunning;
  let t=setInterval(()=>{
    if(options.disabled)return;
    if(options.destoryIfNoTask && !this.hasTask())
      return this.destory();
    if(queue.length && currentCount<options.maxCount){
      currentCount++;
      let fq=queue.shift();
      let taskId=fq[0],fn=fq[1];
      let task=tasks[taskId]={
        state:1,
        id:taskId,
        result:void 0,
        tq:null
      };
      task.state=TaskQueue.RUNNING;
      currentRunning=fn;
      if(typeof fn==='function'){
        fn((...r)=>{
          currentCount--;
          task.state=TaskQueue.COMPLETED;
          task.result=r;
          cleanCallback(taskId);
          this.reportResult.apply({},r);
        },(taskId)=>{
          let o=tasks[taskId]||{state:0};
          o.addDone=(id,callback)=>{
            if(!callback)callback=id,id=getId();
            addCallback(taskId,id,callback);
          };
          o.removeDone=(id)=>{
            delete callbacks[taskId][id];
          };
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
        };
        task.tq=fn;
        // 启动子任务队列
        fn.run && fn.run();
        // 如果已经destory过，则立即执行
        fn.isDestoried && fn.destory();
      }
    }
  },20);

  this.isDestoried=false; // 是否已被destory过

  // 缺省参数解析器
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

  ((p)=>{
    this.push=(id,fn)=>(queue.push(p(id,fn)),this);
    this.unshift=(id,fn)=>(queue.unshift(p(id,fn)),this);
  })((id,fn)=>fixArgs([String,[Function,Object]],[id,fn],[getId()]));

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

  if(options.disabled)this.run=()=>{options.disabled=false;this.run=undefined;};
  this.destory=()=>{
    this.isDestoried=true;
    clearInterval(t);
    for(let t in tasks)
      tasks[t].tq && tasks[t].tq.destory();
    this.destoried();
  };

  this.hasTask=()=>currentCount+queue.length;
  this.currentTask=()=>currentCount;
  this.currentRunning=()=>currentRunning;
  // 给自己实例的接口
  this.reportResult=this.destoried=()=>{};

};



