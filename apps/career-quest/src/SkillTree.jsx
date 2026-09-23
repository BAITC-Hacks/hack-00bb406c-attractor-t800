import { useId, useState } from 'react';
import { Icon } from './Icon';

// Each mask reveals a part of the supplied tree artwork, never an unearned skill.
const slots = [
 {id:'python',x:47,y:14,tagX:48,tagY:3,clip:'250,0 906,0 906,220 851,322 831,388 799,476 723,530 646,605 613,682 542,681 518,513 245,476'},
 {id:'api',x:19,y:43,tagX:13,tagY:29,clip:'0,350 297,350 477,407 499,628 637,776 620,851 439,751 216,671 0,699'},
 {id:'sql',x:80,y:46,tagX:83,tagY:36,clip:'920,395 992,353 1254,350 1254,749 1070,809 907,797 719,906 647,1000 614,864 747,709 771,551 818,456'},
 {id:'communication',x:29,y:64,tagX:18,tagY:70,clip:'245,693 444,705 487,811 633,896 633,967 485,884 239,872'},
 {id:'product',x:70,y:65,tagX:82,tagY:73,clip:'838,710 1010,714 1010,881 820,900 688,927 657,952 634,890 773,796'},
 {id:'system-design',x:75,y:24,tagX:83,tagY:14,clip:'878,204 1163,183 1158,421 944,453 766,475 664,584 630,593 647,527 750,398 826,301'},
];
const extras = [{x:37,y:29},{x:59,y:33},{x:58,y:53}];
export const levelName = (n) => ['','Базовый','Прикладной','Продвинутый'][n] || 'Подтверждён';
export function SkillTree({employee, onSkill, onList, freshSkill, compact=false}) {
 const uid=useId().replace(/:/g,'');
 const [replay,setReplay]=useState(0);
 const fixed=slots.map(s=>({slot:s,skill:employee.skills.find(k=>k.id===s.id)}));
 const unused=employee.skills.filter(k=>!slots.some(s=>s.id===k.id));
 for(const entry of fixed) if(!entry.skill && entry.slot.id!=='system-design' && unused.length)entry.skill=unused.shift();
 const assigned=fixed.filter(e=>e.skill);
 const fullGreenCanopy=assigned.filter(e=>e.slot.id!=='system-design').length===5;
 const hasGoldenBranch=assigned.some(e=>e.slot.id==='system-design');
 return <section className={`tree-section ${compact?'tree-compact':''}`} aria-label={`Дерево: ${employee.skills.length} подтверждённых навыков`}>
   <div className="tree-canvas" key={`${employee.id}-${replay}`}>
    <svg className="tree-art" viewBox="0 0 1254 1254" aria-hidden="true">
     <defs><filter id={`${uid}-soft`}><feGaussianBlur stdDeviation="3"/></filter><mask id={`${uid}-tree`}><g fill="white" filter={`url(#${uid}-soft)`}><path d="M542 598 L637 566 L664 767 L688 906 L740 1077 L967 1108 L967 1215 L297 1215 L297 1100 L535 1077 L548 878 Z" />
      {assigned.map(({slot,skill},i)=><polygon key={skill.id} points={slot.clip} className={freshSkill===skill.id || replay?'branch-growing':''} style={{animationDelay:`${replay?i*100:0}ms`,transformOrigin:`${slot.x*12.54}px ${slot.y*12.54}px`}}/>)}</g>
     </mask><clipPath id={`${uid}-leaf-cluster`}><path d="M246 698 L447 704 L465 764 L468 823 L503 845 L490 871 L331 870 L246 820Z"/></clipPath></defs>
     {fullGreenCanopy?<><image href="/assets/skill-tree-five.png" width="1254" height="1254" className={replay?'tree-reveal':''}/>{hasGoldenBranch&&<image href="/assets/skill-tree.png" width="1254" height="1254" className={freshSkill==='system-design'||replay?'crown-reveal':''}/>}</>:<image href={hasGoldenBranch?'/assets/skill-tree.png':'/assets/skill-tree-five.png'} width="1254" height="1254" mask={`url(#${uid}-tree)`}/>}
     {unused.map((skill,i)=><g key={skill.id} transform={`translate(${[140,425,443][i%3]} ${[-470,-390,-133][i%3]})`} style={{mixBlendMode:'multiply'}}><g className={freshSkill===skill.id || replay?'branch-growing':''} style={{transformOrigin:'420px 800px'}}><image href="/assets/skill-tree.png" width="1254" height="1254" clipPath={`url(#${uid}-leaf-cluster)`}/></g></g>)}
    </svg>
    {assigned.map(({slot,skill})=><button key={skill.id} className={`tree-label ${skill.level===3?'gold':''} ${freshSkill===skill.id?'new-skill':''}`} style={{left:`clamp(72px, ${slot.tagX}%, calc(100% - 72px))`,top:`${slot.tagY}%`}} onClick={()=>onSkill(skill)} aria-label={`${skill.title}, ${skill.score} из 100, ${levelName(skill.level)}`}>
       <span className="tree-dot"/><span><strong>{skill.title}</strong><small>{skill.score} / 100 · {levelName(skill.level)}</small></span>
    </button>)}
    {unused.map((skill,i)=><button key={skill.id} className="tree-label extra-skill new-skill" style={{left:`${(extras[i%3]).x}%`,top:`${(extras[i%3]).y}%`}} onClick={()=>onSkill(skill)}><Icon name="leaf" size={20}/><span><strong>{skill.title}</strong><small>{skill.score} / 100</small></span></button>)}
    {!employee.skills.length&&<p className="tree-empty">Первый подтверждённый навык<br/>станет первой ветвью.</p>}
    <div className="tree-count"><Icon name="shield-check" size={15}/>{employee.skills.length} подтверждённых навыков</div>
   </div>
   <div className="tree-legend"><span><Icon name="sprout"/><b>Побег</b><small>Базовый</small></span><span><Icon name="git-branch"/><b>Ветвь</b><small>Прикладной</small></span><span><Icon name="leaf" className="gold-icon"/><b>Крона</b><small>Продвинутый</small></span></div>
   <div className="tree-actions"><small>Дерево растёт только после подтверждения навыка.</small><button onClick={()=>setReplay(n=>n+1)}><Icon name="play" size={15}/>Анимация роста</button><button onClick={onList}><Icon name="list" size={17}/>Навыки списком</button></div>
 </section>;
}
