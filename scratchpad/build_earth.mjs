// 只输出 apply_patch 补丁，不写文件。以地球蓝图为人物资料来源。
import fs from 'node:fs';
const read = p => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const blueprint = read('Doc/世界书设定相关/地球蓝图.md');
const q = s => JSON.stringify(s, null, 2);
const template = s => '`' + s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${') + '`';
function data(value, depth=0) {
  if(typeof value==='string') return value.includes('\n') ? template(value) : q(value);
  if(value===null || typeof value!=='object') return q(value);
  if(Array.isArray(value)) return '['+value.map(v=>data(v,depth+1)).join(', ')+']';
  const pad='  '.repeat(depth);
  return '{\n'+Object.entries(value).map(([k,v])=>pad+'  '+q(k)+': '+data(v,depth+1)).join(',\n')+'\n'+pad+'}';
}
const changes = [];
function put(path, text) {
  text = text.trimEnd() + '\n';
  if (fs.existsSync(path)) {
    const old = read(path);
    if (old === text) return;
    const a=old.trimEnd().split('\n'), b=text.trimEnd().split('\n');
    let start=0, end=0;
    while(start<Math.min(a.length,b.length) && a[start]===b[start]) start++;
    while(end<Math.min(a.length,b.length)-start && a[a.length-1-end]===b[b.length-1-end]) end++;
    const context=a.slice(Math.max(0,start-2),start).map(l=>' '+l);
    const tail=end?a.slice(a.length-end,a.length-end+2).map(l=>' '+l):[];
    changes.push(`*** Update File: ${path}\n@@\n` + [...context,...a.slice(start,a.length-end).map(l=>'-'+l),...b.slice(start,b.length-end).map(l=>'+'+l),...tail].join('\n'));
  } else changes.push(`*** Add File: ${path}\n` + text.trimEnd().split('\n').map(l => '+' + l).join('\n'));
}
const groups = [
  {id:'CN', region:'中国', kws:['中国','北京','洛阳','东风修仙基地','仙改委','华修院'], school:'东风修仙基地'},
  {id:'EU', region:'欧盟', kws:['欧盟','意大利','罗马','法国','德国','西班牙','葡萄牙','圣约神学院','奥瑞安'], school:'圣约神学院'},
  {id:'US', region:'英美', kws:['英美','美国','英国','波士顿','新黎明神学院','赫利昂','远界资本'], school:'新黎明神学院'},
];
const people = [...blueprint.matchAll(/^#### (CN\d\d|EU\d\d|US\d\d) ([^\n]+)\n([\s\S]*?)(?=\n### |\n#### |(?![\s\S]))/gm)].map(m => {
  const fields = Object.fromEntries([...m[3].matchAll(/^- ([^：\n]+)：([^\n]+)/gm)].map(x => [x[1],x[2]]));
  const [gender,race,age,look,realm,root] = fields.基础.split('｜');
  return {id:m[1],name:m[2],gender,race,age:parseInt(age),look:look.replace('外观为',''),realm:realm.replace('前期','初期'),root:root.replace(/。$/,''),fields};
});
if(people.length!==22) throw Error('人物解析数量不符');
const regions = {
中国: `# 中国
佛道与隐世世家保存传承，现代公共教育、科研与工业协同发展。凡人的组织、工程和生产能力参与决定修士行动的成败。
## 管理与培养
- 国家仙道发展与改革委员会（仙改委）：受中共直接领导，统筹登记、公共灵石、培养与跨界事务。全体修士登记，必要时接受征召；入学自愿。
- 华夏修真科学院（华修院）：研究经典、制石、动力与修真工业，协作培养。
- 东风修仙基地：北京，全国统一公共培养学府，按境界分级；讲师按专长任用，凡人工程师与文献学者同样授课。
- 六方向：功法术法、丹药医理、炼器工学、阵法工程、灵植生态、驯兽异类。佛道与世家导师参与共同课程和专业教学。
- 公共资源按用途与需要配置；资助附带任务、用途核查、行动留档及纪律监督。培养包含马列主义课程与学习强国积分要求。
- 已登记的非在校修士可购石、接公开任务、申请资助；学员另有导师、设施与培养配额。
## 城市生活
北京基地有教学庭院、阅览楼、工学楼、药圃、食堂与宿舍，日常围绕选课、实验、同伴和导师展开。事务大厅办理登记、项目与资源核查；装备库负责借还，华修院合作实验室进行制石与动力试验。
洛阳市区灵务联络窗口承接登记和地方调查，伊河沿岸集合点组织龙门考察。居民报告异变，商户备货，学员参与调查；往返北京须安排交通。
## 参与线索
教学配额被紧急行动挤占；家传阵理与公开实验记录发生冲突；制石样品异常需要工程复现；洛阳植物异变连接地方调查与北京求学。`,
欧盟: `# 欧盟
以罗马为首批舞台。天主教传承网络、各国公共机构与资本共同培养修士，各国保留本地管理和执法权。
## 组织与培养
- 欧洲灵务协作理事会：协调资格互认、跨国考察与联合救援。
- 圣约神学院：罗马的修行学院，传承教师、研究者及资助代表参与院务；神父讲授传承，修女承担医理等专长，凡人修复师、工程师和语言学者同样任教。
- 按修为分组、能力组队；共同课程含引气、经典、术法控制、现代科学、救护与法律。特色为圣物修复、医理净化、仪式阵法、古文与遗迹解读。
- 基础与技术课程向非信教者开放，宗教职务与内部传承另有条件。
- 公共奖助对应救援、医疗和公共研究；教会资助对应传承整理、修复或约定宗教职责；企业资助对应考察服务、成果授权和保密合同。
- 奥瑞安资源集团经营天然灵石矿业、工程与运输，资助材料实验室和考察，争取勘矿技术及成果权益。
## 罗马生活
圣约神学院的庭院连接文献室、修复工坊、食堂与考察办公室。学生带样品上课，在咖啡馆讨论名单；奥瑞安项目办公室协商合同，装备间交接样品与筹备跨国行程。
毕业可进入公共行动、研究、教会传承或企业项目。研究署名、资料开放与资助席位构成长线矛盾。
## 参与线索
旧器物的导水阵既可改善居民供水，也被企业争取独家开发；抄本保管者要求先归还器物；完成关键译读的非信教学生希望取得合作研究资格。`,
英美: `# 英美
新教背景神学院、大学合作项目与企业培养并存。美国侧重投资、研究与人才竞争；英国侧重历史学院、传统基金和传承关系。
## 美国：波士顿
- 新黎明神学院：多个传承团体与教育基金支持；董事会管理经费，教师主持教学，企业以奖学金和实验室影响项目。
- 招生综合灵根、既有修习与专业能力；修行课按境界分组，研究按专长组队。特色为经典、医理、术法测量、灵石动力、装备工程和野外行动。
- 凡人工程师可任讲师与项目负责人；基础与技术课程向非信教者开放，宗教身份和内部传承另有条件。
- 赫利昂能源集团经营能源、工业制石与动力设备，提供实验设施和实习。
- 远界资本经营修行学贷、装备租赁、行动融资和部分矿业权益，以资金、合同和成果权约束受资助者，并秘密使用受控执行者。
- 政府项目奖助对应约定公共服务，私人奖学金为无偿资助，企业学贷依借贷合同计息偿还。学贷以美元记账，领石数量和当次价格单列。
## 城市生活
教学楼、资助厅、学生公寓与赫利昂实验室连成日常：上课、兼职、拼模型、设备实测和账单协商。远界项目办公室发布简报，临港装备点组织船艇前往港湾。
毕业去向有政府项目、企业行动队、实验室和独立承包。民众参与工程、生态观测、后勤与社区救援。
## 参与线索
学生争取公共岗位以调整企业依附；制石成果公开与保密期冲突；实习风险被低报；财团以秘密傀儡术控制执行者，医疗记录与指令授权是调查线索。`,
};
// 日期统一使用修仙历。
const sites = [
{region:'中国',name:'白云观·清息道场',kws:['白云观','清息道场'],open:'7025-04-12',brief:'北京白云观，稳定调息与经典研习地。',body:'气流沿院落石缝循环。顾清霄定期讲调息，沈伯谦研读经典，陆知微测绘气流；登记修士可预约，凡人可旁听或参与工程。设备安装改变气流时，测绘与修行经验共同修复环境。教学、个人修炼与场所维护共享有限时段。'},
{region:'中国',name:'龙门·回澜石窟',kws:['龙门','回澜石窟'],open:'7025-12-18',brief:'洛阳伊河岸，水光岩壁通向导流遗迹；炼气协作、筑基深入。',body:'程雁回组织考察，明澄救护，周小满记录生态。入口窗口依现场灵潮测量。\n1. 岸边勘测：用绳索、测量与水属感知分辨倒影，记录入口。\n2. 分流石室：疏通灵泉旁路，救出困在高处的先遣人员，取得导流残图。\n3. 回声长廊：诵读残响扰乱判断，强施术放大回声；辨读、调息与分组传讯取得阵纹拓录。\n4. 水脉中枢：修复泄流或封闭岔道，回收可拆卸损坏阵件与观察记录。\n收获：炼气至筑基水属材料、导流阵理、救援与研究报酬。修复后的外围可预约调查。'},
{region:'中国',name:'嵩山·中岳星台',kws:['嵩山','太室山','中岳星台'],warning:'7026-03-14',open:'7026-03-21',notice:'7026-03-23',sign:'河南登封太室山测绘出现稳定方位偏差。',brief:'登封太室山的折叠观测空间；炼气测绘、筑基探索核心。',body:'顾清霄指导，陆知微与唐砚秋协作；旧传承经验与仪器结果初看相悖。\n1. 山径定向：转身后道路变化，用实地标记与连续测量建坐标。\n2. 错位石阶：队员所见阶梯不同，统一观测时序和联络点，取得星位刻图。\n3. 三座辅台：工程人员调结构，修士分点输灵，同时稳定阵位。\n4. 主台复位：旋转阵盘挤压出口，可恢复观测功能或保退路封存主台，取观测阵理与损坏样件。\n收获：同阶材料、阵理与实践评价；外围可转为测绘教学地。'},
{region:'欧盟',name:'蒂沃利·百泉调息庭',kws:['蒂沃利','埃斯特别墅','百泉调息庭'],open:'7025-06-08',brief:'意大利蒂沃利埃斯特别墅水道，稳定恢复与观测场所。',body:'阿涅丝指导恢复，伊内斯研究旧水道，索菲娅记录节律；研习与日常维护、参观协调排程。资源为修习条件和数据。奥瑞安出资换管，要求优先获取实验成果；改造是否影响灵气循环需实测。'},
{region:'欧盟',name:'奥斯蒂亚·回潮水廊',kws:['奥斯蒂亚','回潮水廊'],open:'7025-11-22',brief:'意大利奥斯蒂亚古城调查点通向地下水廊，潮水来自秘境内部；炼气协作、筑基深入。',body:'伊内斯与索菲娅辨读，克拉拉供装备，玛尔塔协调合同。\n1. 干井测绘：以高差、绳索、风向排除误导水声，取得断面图。\n2. 旧库清障：防盐雾侵蚀，识别结构或制服误判人员的搬运傀儡，取得货运标记。\n3. 分水闸室：开闸会淹没另一通道，先安排人员与仪器上高处，再分步操作取得水路图。\n4. 蓄灵池：分段卸压、修管或封存损坏池段，取失效控制件与少量凝结材料。\n收获：水工阵理、炼气至筑基材料与项目报酬；公共供水用途与商业开发权存在争议。'},
{region:'欧盟',name:'圣米歇尔·潮钟回廊',kws:['圣米歇尔','潮钟回廊'],warning:'7026-06-07',open:'7026-06-14',notice:'7026-06-16',sign:'法国圣米歇尔山海湾出现无声源低鸣与异常灵力节律。',brief:'法国圣米歇尔山海湾折叠回廊；炼气岸上支援、筑基组队深入。',body:'罗马团队须跨国赴法。阿涅丝救护，马泰奥提供远程意见，玛尔塔协调；入口依灵潮监测。\n1. 岸边接应：建观察点、追踪信号，分辨雾中错位路径。\n2. 潮音回廊：声学测量、阵法与分段标记打破回返，寻找被困人员。\n3. 断裂钟架：强施术加剧共振，以工程支撑和低强度分点镇定取共振与阵纹资料。\n4. 回流中庭：分配稳流、撤离和取件时间，未取深处器件可留待回访。\n收获：防护消振阵理、同阶材料与救援评价；修复外围可作跨国教学点。'},
{region:'英美',name:'瓦尔登·静水岸',kws:['瓦尔登','静水岸'],open:'7025-05-17',brief:'美国康科德瓦尔登湖的平稳灵气岸段，调息与生态观测场所。',body:'塞缪尔组织调息，露丝与莉娅测量，诺拉参与救援练习；凡人承担观测与设施工作。修习和社区游憩共享岸线。某静修点影响植被，须调整安排；企业争取优先使用权，社区要求公共机会。'},
{region:'英美',name:'沃伦堡·回声堡垒',kws:['沃伦堡','乔治斯岛','回声堡垒'],open:'7025-12-06',brief:'波士顿港乔治斯岛重复门洞通向重叠回廊；炼气协作、筑基深入，船艇接应。',body:'露丝提供传感器，诺拉组织学生，艾芙琳奉命回收样本；任务书低报通信失效范围。\n1. 码头布点：有线联络、实体标记与测量校正定位漂移，建立撤离基准。\n2. 折返门廊：回声生成误导影像，停步核对同伴与实体结构，找到先遣记录。\n3. 失控防护室：旧阵误认设备灵力，逐件断能，或修士压阵、工程人员旁路修复，取得控制模块。\n4. 重叠中枢：拆样引起空间收缩，先稳结构撤人，再取可移除部件；强取须紧急撤离。\n收获：防护阵理、同阶部件、任务报酬及隐瞒风险的证据；核心样本一份。证据公开影响资助关系。'},
{region:'英美',name:'德比码头·雾帆仓',kws:['德比码头','塞勒姆','雾帆仓'],warning:'7026-09-26',open:'7026-10-03',notice:'7026-10-05',sign:'美国塞勒姆德比码头出现局部灵雾与重复船影。',brief:'美国塞勒姆德比码头的仓储秘境；炼气协作、筑基护航。',body:'露丝与莉娅调查供能，诺拉协作，薇薇安争取仓储阵商业权。\n1. 雾岸寻路：实体浮标、岸上绞索与仪器校核纠正幻影船引导，记录入口节律。\n2. 错号仓门：比对货签、重量与空间测量，取得货物流转图。\n3. 积压货场：隔离、控制或制服反复搬运失稳容器的运输傀儡，取安全材料。\n4. 压载阵室：分区卸载积压灵气，修复挤压仓间的存储阵，取得阵理与工程记录。\n收获：有容量与耗能限制的仓储阵研究、同阶材料和报酬；恢复后持续研究物流应用。'},
];
const calendarSource = read('../tavern_helper_template-main/util/cultivation-calendar.js').split('/** 只处理时间字段')[0].trimEnd().replaceAll('export function ', 'function ');
const calendarClock = "// BEGIN CULTIVATION_CALENDAR (源: 前端 util/cultivation-calendar.js)\n" + calendarSource + "\n// END CULTIVATION_CALENDAR\nlet 原时间;\ntry { 原时间 = getMessageVar('stat_data.时间'); } catch (_) { /* 读取失败沿用开局基准 */ }\nconst 时间 = cultivationDate(原时间, '地球');";
const clock = calendarClock + "\nconst 今日 = Date.UTC(Number(时间.年), Number(时间.月)-1, Number(时间.日));\nconst 日期值 = s => { const [y,m,d] = s.split('-').map(Number); return Date.UTC(y,m-1,d); };";
const overviewPath = '世界书/地球/[mvu_plot]地球总览.txt';
put(overviewPath, `<%_ {
if (getMessageVar('stat_data.地点.世界') === '地球') {
${calendarClock}
_%>
# 地球总览
修仙历<%= 时间.年 %>年<%= 时间.月 %>月<%= 时间.日 %>日。都市日常、名山探索与灵源争夺并行。
## 复苏与公共生活
远古修仙文明因上次大劫衰落，受损地脉阻断深层灵源向地表输送。7024年，问道仙宗空间试验接通古代节点，引发地脉复流，地球积存的灵气逐步释放；名山古迹成为新的喷发点。
复苏后，人类采用更适于推算灵气潮汐的修仙历。
人们在上班、求学和家庭生活中适应灵根检测、修行教育、异常救援与新能源。科研、制造、后勤和集体组织使凡人参与超凡竞争。
## 地区索引
中国—佛道；日本—神道；俄罗斯—东正教；欧盟—天主教；英美—新教；以色列—犹太教；中东—伊斯兰教；印度—印度教；非洲—巫毒。以上为主要修行派系，国家边界与城市沿现实地理。
中国以公共培养与责任监督组织修士；欧盟结合教会、各国公共机构和企业；英美以分散办学、资本资助与人才竞争为主。各国争夺灵源、能源、人才及跨界关系。
## 跨界通道
地球端位于北太平洋中部公海，海面上方间歇展开竖直裂隙，可监测征兆。小艇靠近，平台接应；各国协调通行救援，共享基本监测，另保独立接触与情报活动。
通道总灵性负荷由人员、妖兽、器物共同占用：开局通常通过炼气，筑基轻装勉强，金丹以上无法通过。凡界端由问道仙宗主导，其他宗门逐渐介入；少数支持交流，多数谋求应劫退路。早期交换人员以低阶修士为主，也有传承、信息、妖兽或探路奴隶抵达。
## 复苏地点
名胜的地脉可借后世建筑显现为秘境。显现提供探索机会。
<event name="地球名胜探索">
探索、救援、取宝或控制权改变后，将结果写入事件.进度.地球名胜[地点全名]，用一段文字记录阶段、人员、已取奖励与现状。回访按此记录续写。
</event>
<%_ }
} _%>`);
const entries = [{name:'[mvu_plot]地域-地球',path:overviewPath,order:52}];
for(const g of groups){
  const cast = people.filter(p=>p.id.startsWith(g.id));
  const regionPath = `世界书/地球/地区/[mvu_plot]地区-地球-${g.region}.txt`;
  const charPath = `世界书/地球/人物/[mvu_plot]人物-地球-${g.region}.txt`;
  g.cast=cast; g.charPath=charPath;
  const characters = Object.fromEntries(cast.map(p=>[p.name,{title:p.fields['身份与地点'],realm:p.realm,appearanceType:p.look,age:p.age,root:p.root,moderate:'外貌: '+p.fields.外貌}]));
  put(regionPath, `<%_ {
const 世界 = getMessageVar('stat_data.地点.世界');
const 地域 = String(getMessageVar('stat_data.地点.地域') || '');
if (世界 === '地球' && ${q(g.kws)}.some(k => 地域.includes(k))) {
const 具体地点 = String(getMessageVar('stat_data.地点.具体地点') || '');
const 人物关系 = getMessageVar('stat_data.关系列表') || {};
const 探索记录 = getMessageVar('stat_data.事件.进度.地球名胜') || {};
${clock}
const localSetting = ${template(regions[g.region])};
const characters = ${data(characters)};
const sites = ${data(sites.filter(s=>s.region===g.region))};
const profileOut = Object.entries(characters).map(([name,c]) => {
  if (Object.prototype.hasOwnProperty.call(人物关系,name)) return c.title + ': ' + name;
  const age = c.age + Math.max(0,Number(时间.年)-7026);
  return c.realm + ' ' + name + '(' + c.appearanceType + ')｜人族，' + age + '岁，' + c.root + '\\n身份: ' + c.title + '\\n' + c.moderate;
}).join('\\n');
const siteOut = sites.map(s => {
  if (今日 < 日期值(s.open)) return s.warning && 今日 >= 日期值(s.warning) ? '- 异常报告：' + s.sign : '';
  const notice = s.notice && 今日 >= 日期值(s.notice) ? ' 已发布调查与协作招募。' : '';
  const record = 探索记录[s.name] ? '\\n当前记录: ' + 探索记录[s.name] : '';
  return 具体地点 && s.kws.some(k => 具体地点.includes(k)) ? '### ' + s.name + '\\n' + s.brief + notice + record + '\\n场景与探索参考:\\n' + s.body : '- ' + s.name + '：' + s.brief + notice + record;
}).filter(Boolean).join('\\n');
_%>
<%- localSetting %>
## 地区人物
<%- profileOut %>
## 当前复苏名胜
<%- siteOut %>
<%_ }
} _%>`);
  const C = Object.fromEntries(cast.map(p=>{
    const body = Object.entries(p.fields).filter(([k])=>!['基础','外貌','身份与地点'].includes(k)).map(([k,v])=>k+': '+v).join('\n').replace('，不担任神父或司铎职务','').replace('，不靠一句劝说完成','').replace('，并非全球顶尖战力或能压过元婴的万能武器','');
    return [p.name,{kws:[p.name,...(p.name.includes('·')?[p.name.split('·')[0]]:[]),...(p.name==='明澄'?['明澄法师']:[])],locationKws:[],moderate:'### '+p.name+' ('+p.look+')\n身份: '+p.fields['身份与地点']+'\n外貌: '+p.fields.外貌,detail:'### '+p.name+' ('+p.look+')\n身份: '+p.fields['身份与地点']+'\n外貌: '+p.fields.外貌+'\n'+body}];
  }));
  put(charPath, `<%_ {
const 人物关系 = getMessageVar('stat_data.关系列表') || {};
const 具体地点 = String(getMessageVar('stat_data.地点.具体地点') || '');
const recentText = (getChatMessages(-10) || []).join('\\n');
const C = ${data(C)};
const outputText = Object.entries(C).map(([name,c]) => {
  if (Object.prototype.hasOwnProperty.call(人物关系,name)) return c.detail;
  return c.kws.some(k => recentText.includes(k)) || c.locationKws.some(k => 具体地点.includes(k)) ? c.moderate : '';
}).filter(Boolean).join('\\n\\n');
_%>
<%- outputText %>
<%_ } _%>`);
  entries.push({name:`[mvu_plot]地区-地球-${g.region}`,path:regionPath,order:53});
  entries.push({name:`[mvu_plot]人物-地球-${g.region}`,path:charPath,order:200,kws:[...new Set([...Object.values(C).flatMap(c=>c.kws),...g.kws])]});
}
function yamlEntry(e){return `  - 名称: "${e.name}"
    启用: true
    激活策略:
      类型: ${e.kws?'绿灯':'蓝灯'}${e.kws?'\n      关键字:\n'+e.kws.map(k=>'        - '+k).join('\n'):''}
    插入位置:
      类型: 角色定义之前
      顺序: ${e.order}
    激活概率: 100${e.kws?'\n    特殊效果:\n      黏性: 5':''}
    递归:
      不可被其他条目激活: false
      不可激活其他条目: true
    文件: ${e.path.slice(0,-4).replaceAll('/','\\')}

`;}
let yaml=read('本格修仙.yaml');
if(!yaml.includes('文件: 世界书\\地球\\')){
  yaml=yaml.replace('  - 名称: ➤人物信息-end',entries.map(yamlEntry).join('')+'  - 名称: ➤人物信息-end');
  put('本格修仙.yaml',yaml);
}
// 沿用原 CSV 列序；未经设计的衣饰、恋爱等字段留空。
const csvPath='Doc/世界书设定相关/角色蓝图.csv';
let csv=read(csvPath);
const headers=csv.split('\n')[0].replace(/^\uFEFF/,'').split(',');
const cell=s=>/[",\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;
for(const g of groups)for(const p of g.cast){
  if(csv.split('\n').some(l=>l.startsWith(p.name+',')))continue;
  const row={'人物名称':p.name,'性别':p.gender,'关键字':p.name+'、'+g.school,'初遇地点':g.school,'外观':p.look,'外观特征':p.fields.外貌,'性格特征':p.fields['性格与生活'],'世界':'地球','大陆':g.region,'种族':p.race,'初始境界':p.realm,'实际年龄':String(p.age),'所属分组':g.school,'身份职责':p.fields['身份与地点'],'人物世界书文件':g.charPath,'关系与交往':p.fields['关系与剧情'],'可选故事':p.fields['职责与矛盾']||p.fields['积累与职责']||''};
  csv=csv.trimEnd()+'\n'+headers.map(k=>cell(row[k]||'')).join(',')+'\n';
}
put(csvPath,csv);
console.log('*** Begin Patch\n'+changes.join('\n')+'\n*** End Patch');
