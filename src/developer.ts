import './developer.css';
import { mountAgentManager, refreshAgentCount } from './developer-agents';
import { mountSkillManager, refreshSkillCount } from './developer-skills';
import { mountApiManager, refreshApiStatus } from './developer-api';

type SectionId = 'overview' | 'agents' | 'skills' | 'api' | 'rules' | 'debug' | 'release' | 'preview';

interface NavItem {
  id: SectionId;
  label: string;
  hint: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: '项目概览', hint: '状态与快捷入口', icon: 'grid' },
  { id: 'agents', label: 'Agent 管理', hint: '角色与行为目标', icon: 'agent' },
  { id: 'skills', label: 'Skill 管理', hint: '能力与触发规则', icon: 'skill' },
  { id: 'api', label: '模型提供商', hint: '凭据与模型池', icon: 'api' },
  { id: 'rules', label: '游戏规则', hint: '预算与互斥关系', icon: 'rules' },
  { id: 'debug', label: '调试台', hint: '查看执行过程', icon: 'debug' },
  { id: 'release', label: '配置发布', hint: '版本与回滚', icon: 'release' },
  { id: 'preview', label: '游戏预览', hint: '验证实际效果', icon: 'preview' }
];

const ICONS: Record<string, string> = {
  grid: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/>',
  agent: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20c.8-4 3.3-6 7.5-6s6.7 2 7.5 6"/>',
  skill: '<path d="m12 3 2.2 4.8L19 10l-4.8 2.2L12 17l-2.2-4.8L5 10l4.8-2.2z"/><path d="m19 16 .8 1.7 1.7.8-1.7.8L19 21l-.8-1.7-1.7-.8 1.7-.8z"/>',
  api: '<path d="M8 9V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4M8 15v4a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-4M5 9h14v6H5z"/>',
  rules: '<path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"/>',
  debug: '<path d="M9 4h6l1 3h3v4h-2v2h2v4h-3l-1 3H9l-1-3H5v-4h2v-2H5V7h3zM9 10h6v5a3 3 0 0 1-6 0z"/>',
  release: '<path d="M12 3v12M7 8l5-5 5 5M5 14v6h14v-6"/>',
  preview: '<path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="2.5"/>'
};

const icon = (name: string) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

const app = document.querySelector<HTMLDivElement>('#developer-app');
if (!app) throw new Error('Developer app root is missing.');

app.innerHTML = `
  <div class="shell">
    <aside class="sidebar">
      <a class="brand" href="/" aria-label="返回游戏">
        <span class="brand-mark">GH</span>
        <span><strong>GRAVEHORDE</strong><small>AI DEV CONSOLE</small></span>
      </a>
      <div class="project-chip">
        <span class="project-avatar">灵</span>
        <span><small>当前项目</small><strong>精灵进化试验场</strong></span>
        <span class="chip-caret">⌄</span>
      </div>
      <nav class="nav" aria-label="后台导航">
        ${NAV_ITEMS.map(item => `
          <button class="nav-item${item.id === 'overview' ? ' active' : ''}" data-section="${item.id}" type="button">
            <span class="nav-icon">${icon(item.icon)}</span>
            <span><strong>${item.label}</strong><small>${item.hint}</small></span>
          </button>
        `).join('')}
      </nav>
      <div class="sidebar-footer">
        <span class="local-dot"></span>
        <span><strong>本地开发模式</strong><small>数据仅保存在此设备</small></span>
      </div>
    </aside>

    <main class="main">
      <header class="topbar">
        <div>
          <p class="eyebrow">DEVELOPER WORKSPACE</p>
          <h1 id="page-title">项目概览</h1>
        </div>
        <div class="top-actions">
          <span class="connection"><i></i> 本地服务已连接</span>
          <a class="ghost-button" href="/">返回游戏</a>
          <button class="primary-button" type="button" data-section="preview">打开预览</button>
        </div>
      </header>
      <section id="workspace" class="workspace" aria-live="polite"></section>
    </main>
  </div>
`;

const overviewTemplate = () => `
  <div class="welcome-card">
    <div>
      <span class="badge">第一阶段 · 框架已就绪</span>
      <h2>把 AI 创意变成<br><em>可控制的游戏内容</em></h2>
      <p>在同一个后台中配置 Agent、组合 Skill、校验规则，并把通过测试的内容发布到游戏。</p>
      <div class="welcome-actions">
        <button class="primary-button" type="button" data-section="agents">创建第一个 Agent</button>
        <button class="ghost-button" type="button" data-section="debug">进入调试台</button>
      </div>
    </div>
    <div class="flow-card" aria-label="运行流程">
      <span class="flow-node violet">Agent<small>决定目标</small></span>
      <i>→</i>
      <span class="flow-node cyan">Skill<small>执行能力</small></span>
      <i>→</i>
      <span class="flow-node amber">规则引擎<small>安全校验</small></span>
      <i>→</i>
      <span class="flow-node green">游戏<small>应用结果</small></span>
    </div>
  </div>

  <div class="metric-grid">
    <article class="metric"><span>${icon('agent')}</span><div><small>Agents</small><strong data-agent-count>0</strong><p data-agent-count-hint>等待创建</p></div></article>
    <article class="metric"><span>${icon('skill')}</span><div><small>Skills</small><strong data-skill-count>0</strong><p data-skill-count-hint>等待创建</p></div></article>
    <article class="metric"><span>${icon('api')}</span><div><small>API 状态</small><strong class="metric-label" data-api-status>未配置</strong><p data-api-status-hint>当前使用本地创意</p></div></article>
    <article class="metric"><span>${icon('release')}</span><div><small>已发布版本</small><strong>0</strong><p>尚无发布记录</p></div></article>
  </div>

  <div class="content-grid">
    <article class="panel getting-started">
      <div class="panel-heading"><div><p class="eyebrow">GETTING STARTED</p><h3>开始搭建 AI 工作流</h3></div><span>0 / 4</span></div>
      ${[
        ['agents', '01', '创建 Agent', '定义它的身份、目标和行为边界'],
        ['skills', '02', '添加 Skill', '给 Agent 配置可使用的具体能力'],
        ['api', '03', '配置模型提供商', '填写一次 API，再把需要的模型加入模型池'],
        ['debug', '04', '运行第一次测试', '检查输出、规则校验和执行记录']
      ].map(([id, num, title, desc]) => `
        <button class="start-row" type="button" data-section="${id}">
          <span>${num}</span><span><strong>${title}</strong><small>${desc}</small></span><b>→</b>
        </button>
      `).join('')}
    </article>
    <article class="panel activity">
      <div class="panel-heading"><div><p class="eyebrow">ACTIVITY</p><h3>最近活动</h3></div><button type="button">全部记录</button></div>
      <div class="empty-orbit"><span>${icon('debug')}</span></div>
      <strong>还没有运行记录</strong>
      <p>完成第一次 Agent 测试后，调用过程会显示在这里。</p>
    </article>
  </div>
`;

const sectionTemplate = (item: NavItem) => `
  <div class="section-shell">
    <div class="section-intro">
      <span class="large-icon">${icon(item.icon)}</span>
      <div><p class="eyebrow">${item.id.toUpperCase()} WORKSPACE</p><h2>${item.label}</h2><p>${sectionDescription(item.id)}</p></div>
      <span class="status-pill">下一阶段开放</span>
    </div>
    <div class="placeholder-grid">
      <article class="placeholder-card featured">
        <span class="card-icon">${icon(item.icon)}</span>
        <h3>${sectionPrimaryAction(item.id)}</h3>
        <p>页面框架已经预留完成。确认后台视觉和导航后，下一步将在这里接入真实的创建与编辑功能。</p>
        <button class="primary-button" type="button" disabled>即将开始</button>
      </article>
      <article class="placeholder-card"><p class="eyebrow">DESIGN PRINCIPLE</p><h3>安全、可验证、可回滚</h3><p>AI 生成内容必须先经过结构校验和游戏规则检查，才能进入正式配置。</p></article>
      <article class="placeholder-card"><p class="eyebrow">LOCAL FIRST</p><h3>数据留在项目目录</h3><p>开发阶段的配置会统一保存到 developer-data 文件夹，便于备份和版本管理。</p></article>
    </div>
  </div>
`;

function sectionDescription(id: SectionId) {
  const descriptions: Record<SectionId, string> = {
    overview: '',
    agents: '创建和管理负责进化、剧情与战斗设计的 AI 角色。',
    skills: '把提示词、输入输出和调用权限封装成可复用能力。',
    api: '统一管理模型提供商凭据，并选择哪些模型可供 Agent 使用。',
    rules: '维护属性预算、能力成本、互斥关系和阶段上限。',
    debug: '查看每一次输入、Agent 判断、Skill 调用和规则校验结果。',
    release: '把测试通过的配置保存为版本，并支持发布与回滚。',
    preview: '在真实游戏界面中验证 Agent 生成的内容和战斗效果。'
  };
  return descriptions[id];
}

function sectionPrimaryAction(id: SectionId) {
  const actions: Record<SectionId, string> = {
    overview: '',
    agents: '创建第一个 Agent',
    skills: '创建第一个 Skill',
    api: '添加模型提供商',
    rules: '编辑进化规则集',
    debug: '开始一次调试运行',
    release: '创建首个配置版本',
    preview: '打开游戏内实时预览'
  };
  return actions[id];
}

const workspace = document.querySelector<HTMLElement>('#workspace')!;
const pageTitle = document.querySelector<HTMLElement>('#page-title')!;

function showSection(id: SectionId) {
  const item = NAV_ITEMS.find(candidate => candidate.id === id) ?? NAV_ITEMS[0];
  pageTitle.textContent = item.label;
  document.querySelectorAll<HTMLElement>('.nav-item').forEach(button => {
    button.classList.toggle('active', button.dataset.section === item.id);
  });
  workspace.onclick = null;
  workspace.onsubmit = null;
  if (item.id === 'agents') {
    void mountAgentManager(workspace);
  } else if (item.id === 'skills') {
    void mountSkillManager(workspace);
  } else if (item.id === 'api') {
    void mountApiManager(workspace);
  } else {
    workspace.innerHTML = item.id === 'overview' ? overviewTemplate() : sectionTemplate(item);
    if (item.id === 'overview') {
      void refreshAgentCount();
      void refreshSkillCount();
      void refreshApiStatus();
    }
  }
  workspace.scrollTop = 0;
}

document.addEventListener('click', event => {
  const target = (event.target as HTMLElement).closest<HTMLElement>('[data-section]');
  const section = target?.dataset.section as SectionId | undefined;
  if (section) showSection(section);
});

showSection('overview');
