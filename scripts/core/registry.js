// ==========================================
// 工业级存储引擎：Dexie.js
// ==========================================

// 1. 声明数据库与版本
const db = new Dexie("NikoDB_Pro");

// 2. 定义表结构 (Schema) : 'id' 是主键
db.version(1).stores({
    providers: 'id',
    agents: 'id',
    tools: 'id',
    workflows: 'id'
});

// 3. 泛型数据管理器 (极其稳健)
class DexieManager {
    constructor(tableName) {
        this.table = db[tableName];
    }
  
    // 获取全部数据
    async getAll() { return await this.table.toArray(); }
  
    // 获取单条数据
    async get(id) { return await this.table.get(id); }
  
    // 保存（自动处理新增或覆盖更新，绝不产生脏数据）
    async save(item) { await this.table.put(item); }
  
    // 删除
    async delete(id) { await this.table.delete(id); }
}

// 4. 导出四大核心资产库
export const ProviderManager = new DexieManager('providers');
export const AgentManager = new DexieManager('agents');
export const ToolManager = new DexieManager('tools');
export const WorkflowManager = new DexieManager('workflows');
