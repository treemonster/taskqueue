'use strict';
let TaskQueue=require('./TaskQueue');

// 同时进行最多3个并发的回调，执行完成之后自动销毁队列
TaskQueue.create({maxCount:3,destoryIfNoTask:true})
// 添加到队列最后一个
.push('task1',(completed)=>{
  console.log('我排在第一个');
  setTimeout(()=>completed(1,2,3,4),3000);
})
.push((completed,taskById)=>{
  console.log('我排在第二个');
  // 当任务task1执行完成之后，对执行结果进行处理
  taskById('task1').addDone((a,b,c,d)=>{
    console.log('>> ',a+b+c+d);
    completed();
  });
})
// 插到队列第一个
.unshift((completed,taskById,currentTaskQueue)=>setTimeout(()=>{
  console.log('插队了..');
  completed();
  // 销毁当前队列
  // currentTaskQueue.destory();
},0));

