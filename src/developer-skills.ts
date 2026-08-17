export interface SkillRecord {
  id: string;
  name: string;
  key: string;
  category: 'evolution' | 'story' | 'combat' | 'utility';
  description: string;
  trigger: string;
  promptTemplate: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  status: 'draft' | 'active' | 'disabled';
  permissions: {
    readPlayerPrompt: boolean;
    readGameRules: boolean;
    writeFlavor: boolean;
    writeStory: boolean;
    writeVisuals: boolean;
  };
  version: number;
  createdAt: string;
  updatedAt: string;
}

type SkillInput = Omit<SkillRecord, 'id' | 'version' | 'createdAt' | 'updatedAt'>;

const API_URL = '/api/developer/skills';
const DEFAULT_SKILL: SkillInput = {
  name: '进化风味生成',
  key: 'generate_evolution_flavor',
  category: 'evolution',
  description: '根据玩家描述，为固定进化路线生成名称、标签、故事和外观。',
  trigger: '当玩家在第一次进化界面提交精灵描述时调用。',
  promptTemplate: [
    '你要根据玩家的描述，为系统提供的合法进化路线创作风味内容。',
    '玩家描述：{{player_prompt}}',
    '合法路线：{{route_ids}}',
    '规则摘要：{{game_rules}}',
    '只能生成名称、短标签、故事引子和外观描述，不得改变路线 ID、战斗属性、技能成本、预算或互斥关系。'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    required: ['playerPrompt', 'routeIds'],
    properties: {
      playerPrompt: { type: 'string', description: '玩家输入的进化想法' },
      routeIds: { type: 'array', items: { type: 'string' }, description: '规则系统提供的合法路线' }
    }
  },
  outputSchema: {
    type: 'object',
    required: ['variants'],
    properties: {
      variants: {
        type: 'array',
        items: {
          type: 'object',
          required: ['routeId', 'name', 'tagline', 'storyHook', 'visualDescription'],
          properties: {
            routeId: { type: 'string' },
            name: { type: 'string' },
            tagline: { type: 'string' },
            storyHook: { type: 'string' },
            visualDescription: { type: 'string' }
          }
        }
      }
    }
  },
  status: 'draft',
  permissions: {
    readPlayerPrompt: true,
    readGameRules: true,
    writeFlavor: true,
    writeStory: true,
    writeVisuals: true
  }
};

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[char] ?? char));

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) }
  });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? `请求失败（${response.status}）`);
  return data;
}

async function loadSkills() {
  return (await request<{ skills: SkillRecord[] }>(API_URL)).skills;
}

export async function refreshSkillCount() {
  try {
    const skills = await loadSkills();
    const count = document.querySelector<HTMLElement>('[data-skill-count]');
    const hint = document.querySelector<HTMLElement>('[data-skill-count-hint]');
    if (count) count.textContent = String(skills.length);
    if (hint) hint.textContent = skills.length ? `${skills.filter(skill => skill.status === 'active').length} 个已启用` : '等待创建';
  } catch {
    // The overview remains usable while the local data service is restarting.
  }
}

export async function mountSkillManager(container: HTMLElement) {
  let skills: SkillRecord[] = [];
  container.innerHTML = managerShell('<div class="agent-loading"><i></i><span>正在读取本地 Skill 配置……</span></div>');

  try {
    skills = await loadSkills();
    renderList();
  } catch (error) {
    renderServiceError(error instanceof Error ? error.message : '无法连接本地配置服务');
  }

  container.onclick = event => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-skill-action]');
    if (!target) return;
    const action = target.dataset.skillAction;
    const id = target.dataset.skillId;
    if (action === 'new') renderEditor();
    if (action === 'cancel') renderList();
    if (action === 'edit' && id) renderEditor(skills.find(skill => skill.id === id));
    if (action === 'delete' && id) void deleteSkill(id);
    if (action === 'toggle' && id) void toggleSkill(id);
    if (action === 'retry') void reload();
  };

  container.onsubmit = event => {
    const form = event.target as HTMLFormElement;
    if (!form.matches('#skill-editor')) return;
    event.preventDefault();
    void saveSkill(form);
  };

  async function reload() {
    container.innerHTML = managerShell('<div class="agent-loading"><i></i><span>正在重新连接……</span></div>');
    try {
      skills = await loadSkills();
      renderList();
    } catch (error) {
      renderServiceError(error instanceof Error ? error.message : '无法连接本地配置服务');
    }
  }

  function renderList() {
    const body = skills.length ? `
      <div class="agent-list">
        ${skills.map(skill => `
          <article class="agent-card skill-card">
            <div class="agent-card-top">
              <span class="agent-avatar skill-avatar">S</span>
              <div class="agent-identity"><h3>${escapeHtml(skill.name)}</h3><p>${escapeHtml(skill.key)}</p></div>
              <span class="agent-status ${skill.status}">${statusLabel(skill.status)}</span>
            </div>
            <p class="agent-description">${escapeHtml(skill.description)}</p>
            <div class="agent-meta skill-meta">
              <span>分类 <strong>${categoryLabel(skill.category)}</strong></span>
              <span>版本 <strong>v${skill.version}</strong></span>
              <span>输入字段 <strong>${schemaFieldCount(skill.inputSchema)}</strong></span>
              <span>更新 <strong>${formatDate(skill.updatedAt)}</strong></span>
            </div>
            <div class="agent-permissions">${permissionBadges(skill)}</div>
            <div class="agent-card-actions">
              <button class="table-button" type="button" data-skill-action="edit" data-skill-id="${skill.id}">编辑</button>
              <button class="table-button" type="button" data-skill-action="toggle" data-skill-id="${skill.id}">${skill.status === 'active' ? '停用' : '启用'}</button>
              <button class="table-button danger" type="button" data-skill-action="delete" data-skill-id="${skill.id}">删除</button>
            </div>
          </article>
        `).join('')}
      </div>
    ` : `
      <div class="agent-empty skill-empty">
        <span class="empty-agent-mark skill-avatar">S</span>
        <h3>还没有 Skill</h3>
        <p>把提示词、触发条件、输入输出格式和调用权限封装成可复用能力，配置只保存在本地项目中。</p>
        <button class="primary-button" type="button" data-skill-action="new">创建第一个 Skill</button>
      </div>
    `;
    container.innerHTML = managerShell(`
      <div class="agent-toolbar">
        <div><p class="eyebrow">SKILL LIBRARY</p><h3>Skill 列表 <span>${skills.length}</span></h3></div>
        <button class="primary-button" type="button" data-skill-action="new">+ 新建 Skill</button>
      </div>
      ${body}
    `, true);
  }

  function renderEditor(skill?: SkillRecord) {
    const value = skill ?? DEFAULT_SKILL;
    container.innerHTML = managerShell(`
      <form id="skill-editor" class="agent-editor" data-skill-id="${skill?.id ?? ''}">
        <div class="editor-heading">
          <div><p class="eyebrow">${skill ? 'EDIT SKILL' : 'NEW SKILL'}</p><h3>${skill ? `编辑 ${escapeHtml(skill.name)}` : '创建 Skill'}</h3><p>定义何时调用、接收什么数据，以及必须返回什么结果。</p></div>
          <div><button class="ghost-button" type="button" data-skill-action="cancel">取消</button><button class="primary-button" type="submit">保存 Skill</button></div>
        </div>
        <div class="form-message" data-form-message hidden></div>
        <div class="editor-grid">
          <section class="form-panel">
            <div class="form-section-title"><span>01</span><div><h4>身份与用途</h4><p>名称给人看，唯一标识供程序调用。</p></div></div>
            ${field('name', 'Skill 名称', value.name, '例如：进化风味生成', 40)}
            ${field('key', '唯一标识', value.key, '例如：generate_evolution_flavor', 60)}
            <label class="form-field"><span>能力分类</span><select name="category">
              ${selectOption('evolution', value.category, '进化内容')}${selectOption('story', value.category, '剧情叙事')}${selectOption('combat', value.category, '战斗辅助')}${selectOption('utility', value.category, '通用工具')}
            </select></label>
            <label class="form-field"><span>状态</span><select name="status">
              ${selectOption('draft', value.status, '草稿')}${selectOption('active', value.status, '启用')}${selectOption('disabled', value.status, '停用')}
            </select></label>
          </section>
          <section class="form-panel">
            <div class="form-section-title"><span>02</span><div><h4>调用时机</h4><p>描述它解决什么问题以及何时被选中。</p></div></div>
            ${textarea('description', '能力简介', value.description, '说明它能完成什么', 200, 4)}
            ${textarea('trigger', '触发条件', value.trigger, '描述调用这个 Skill 的时机', 300, 5)}
          </section>
          <section class="form-panel wide">
            <div class="form-section-title"><span>03</span><div><h4>提示词模板</h4><p>可使用 {{player_prompt}}、{{route_ids}}、{{game_rules}} 等占位符。</p></div></div>
            ${textarea('promptTemplate', '模板内容', value.promptTemplate, '写清目标、上下文、限制和输出要求', 6000, 10)}
          </section>
          <section class="form-panel wide">
            <div class="form-section-title"><span>04</span><div><h4>输入与输出结构</h4><p>使用 JSON Schema 描述数据，保存前会先检查 JSON 格式。</p></div></div>
            <div class="schema-grid">
              ${jsonTextarea('inputSchema', '输入结构', value.inputSchema)}
              ${jsonTextarea('outputSchema', '输出结构', value.outputSchema)}
            </div>
          </section>
          <section class="form-panel wide">
            <div class="form-section-title"><span>05</span><div><h4>读取与写入权限</h4><p>只开放这个 Skill 真正需要的数据和输出范围。</p></div></div>
            <div class="permission-grid skill-permission-grid">
              ${permission('readPlayerPrompt', '读取玩家描述', '允许读取玩家提交的进化想法', value.permissions.readPlayerPrompt)}
              ${permission('readGameRules', '读取游戏规则', '允许读取路线和限制摘要', value.permissions.readGameRules)}
              ${permission('writeFlavor', '生成名称标签', '允许返回名称与短标签', value.permissions.writeFlavor)}
              ${permission('writeStory', '生成故事', '允许返回故事引子', value.permissions.writeStory)}
              ${permission('writeVisuals', '生成外观描述', '允许返回视觉文字描述', value.permissions.writeVisuals)}
            </div>
            <div class="safety-callout"><strong>数值规则始终由规则引擎管理</strong><span>Skill 不能修改伤害、速度、能力成本、属性预算、互斥关系，也不能执行任意代码。</span></div>
          </section>
        </div>
      </form>
    `, true);
  }

  async function saveSkill(form: HTMLFormElement) {
    const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    const message = form.querySelector<HTMLElement>('[data-form-message]')!;
    const formData = new FormData(form);
    message.hidden = true;
    try {
      const payload: SkillInput = {
        name: String(formData.get('name') ?? ''),
        key: String(formData.get('key') ?? ''),
        category: String(formData.get('category')) as SkillInput['category'],
        description: String(formData.get('description') ?? ''),
        trigger: String(formData.get('trigger') ?? ''),
        promptTemplate: String(formData.get('promptTemplate') ?? ''),
        inputSchema: parseJsonObject(String(formData.get('inputSchema') ?? ''), '输入结构'),
        outputSchema: parseJsonObject(String(formData.get('outputSchema') ?? ''), '输出结构'),
        status: String(formData.get('status')) as SkillInput['status'],
        permissions: {
          readPlayerPrompt: formData.has('readPlayerPrompt'),
          readGameRules: formData.has('readGameRules'),
          writeFlavor: formData.has('writeFlavor'),
          writeStory: formData.has('writeStory'),
          writeVisuals: formData.has('writeVisuals')
        }
      };
      const id = form.dataset.skillId;
      submit.disabled = true;
      submit.textContent = '保存中……';
      await request(id ? `${API_URL}/${id}` : API_URL, {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(payload)
      });
      skills = await loadSkills();
      renderList();
    } catch (error) {
      message.textContent = error instanceof Error ? error.message : '保存失败';
      message.hidden = false;
      submit.disabled = false;
      submit.textContent = '保存 Skill';
      message.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  async function deleteSkill(id: string) {
    const skill = skills.find(item => item.id === id);
    if (!skill || !window.confirm(`确定删除“${skill.name}”吗？此操作不能撤销。`)) return;
    try {
      await request(`${API_URL}/${id}`, { method: 'DELETE' });
      skills = await loadSkills();
      renderList();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '删除失败');
    }
  }

  async function toggleSkill(id: string) {
    const skill = skills.find(item => item.id === id);
    if (!skill) return;
    const { id: _id, version: _version, createdAt: _createdAt, updatedAt: _updatedAt, ...input } = skill;
    input.status = skill.status === 'active' ? 'disabled' : 'active';
    try {
      await request(`${API_URL}/${id}`, { method: 'PUT', body: JSON.stringify(input) });
      skills = await loadSkills();
      renderList();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '状态更新失败');
    }
  }

  function renderServiceError(message: string) {
    container.innerHTML = managerShell(`
      <div class="agent-empty error-state"><span class="empty-agent-mark">!</span><h3>本地配置服务暂不可用</h3><p>${escapeHtml(message)}</p><button class="ghost-button" type="button" data-skill-action="retry">重新连接</button></div>
    `);
  }
}

function managerShell(content: string, open = false) {
  return `
    <div class="section-shell agent-workspace skill-workspace">
      <div class="section-intro">
        <span class="large-icon skill-glyph">S</span>
        <div><p class="eyebrow">SKILLS WORKSPACE</p><h2>Skill 管理</h2><p>把提示词、输入输出和调用权限封装成可复用能力。</p></div>
        <span class="status-pill ${open ? 'available' : ''}">${open ? '本地功能已开放' : '正在连接'}</span>
      </div>
      <div class="agent-content">${content}</div>
    </div>
  `;
}

function field(name: string, label: string, value: string, placeholder: string, max: number) {
  return `<label class="form-field"><span>${label}</span><input name="${name}" value="${escapeHtml(value)}" placeholder="${placeholder}" maxlength="${max}" required /></label>`;
}

function textarea(name: string, label: string, value: string, placeholder: string, max: number, rows: number) {
  return `<label class="form-field"><span>${label}<small>最多 ${max} 字</small></span><textarea name="${name}" placeholder="${placeholder}" maxlength="${max}" rows="${rows}" required>${escapeHtml(value)}</textarea></label>`;
}

function jsonTextarea(name: 'inputSchema' | 'outputSchema', label: string, value: Record<string, unknown>) {
  return `<label class="form-field schema-field"><span>${label}<small>JSON Schema</small></span><textarea name="${name}" rows="17" spellcheck="false" required>${escapeHtml(JSON.stringify(value, null, 2))}</textarea></label>`;
}

function selectOption(value: string, selected: string, label: string) {
  return `<option value="${value}"${value === selected ? ' selected' : ''}>${label}</option>`;
}

function permission(name: keyof SkillInput['permissions'], title: string, description: string, checked: boolean) {
  return `<label class="permission-option"><input type="checkbox" name="${name}"${checked ? ' checked' : ''}/><span><strong>${title}</strong><small>${description}</small></span><i></i></label>`;
}

function parseJsonObject(value: string, label: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`${label}不是有效的 JSON，请检查逗号、引号和括号`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${label}最外层必须是 JSON 对象`);
  }
  return parsed as Record<string, unknown>;
}

function statusLabel(status: SkillRecord['status']) {
  return status === 'active' ? '已启用' : status === 'disabled' ? '已停用' : '草稿';
}

function categoryLabel(category: SkillRecord['category']) {
  return { evolution: '进化', story: '剧情', combat: '战斗', utility: '通用' }[category];
}

function schemaFieldCount(schema: Record<string, unknown>) {
  const properties = schema.properties;
  return properties && typeof properties === 'object' && !Array.isArray(properties) ? Object.keys(properties).length : 0;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function permissionBadges(skill: SkillRecord) {
  const labels = [
    skill.permissions.readPlayerPrompt && '读玩家描述',
    skill.permissions.readGameRules && '读规则',
    skill.permissions.writeFlavor && '写名称标签',
    skill.permissions.writeStory && '写故事',
    skill.permissions.writeVisuals && '写外观'
  ].filter(Boolean);
  return labels.length ? labels.map(label => `<span>${label}</span>`).join('') : '<span class="muted">未开放调用权限</span>';
}
