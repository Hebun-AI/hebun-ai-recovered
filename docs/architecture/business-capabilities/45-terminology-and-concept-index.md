# 45 — Terminology and Concept Index

## Purpose

Provide a controlled Phase 10 vocabulary. Each concept has one canonical English name, a Turkish equivalent, a concise definition, its first defining document, related concepts, and a distinction that prevents model collapse.

## Canonical Index

| Canonical Term | Türkçe karşılığı | Kısa tanım | İlk tanımlandığı belge | İlişkili kavramlar | Karıştırılmaması gereken kavram |
|---|---|---|---|---|---|
| Business Capability | İş Yetkinliği | Enterprise’ın yapabildiği, kalıcı ve isimlendirilmiş business ability | [01](01-what-is-a-business-capability.md) | Identity, Purpose, Taxonomy | Department, Process, Agent, Runtime, Tool |
| Capability Domain | Yetkinlik Alanı | İlişkili Capability’leri gruplayan geniş ability alanı | [09](09-capability-domains.md) | Taxonomy, Capability | Department, tekil Capability |
| Capability Taxonomy | Yetkinlik Taksonomisi | Enterprise → Domain → Capability → Sub-Capability sınıflandırma yapısı | [08](08-enterprise-capability-taxonomy.md) | Hierarchy, Classification | Catalog, Organization Chart |
| Capability Identity | Yetkinlik Kimliği | Bir ability’nin kalıcı adı ve tanımı | [16](16-capability-identity.md) | Purpose, Evolution | Agent identity, Runtime identity |
| Capability Meta Model | Yetkinlik Meta Modeli | Her Capability’nin uyması gereken ortak alan ve kural şablonu | [15](15-capability-meta-model.md) | Identity, Value, Health | Capability instance, database schema |
| Capability Dependency | Yetkinlik Bağımlılığı | Bir ability’nin başka bir ability’ye yapısal olarak dayanması | [19](19-capability-dependencies.md) | Network, Upstream, Downstream | Workflow Sequence, Runtime call |
| Capability Network | Yetkinlik Ağı | Capability düğümleri ve yapısal dependency kenarlarından oluşan ability graph | [23](23-capability-network.md) | Dependency Graph, Criticality | Workflow, execution graph |
| Capability Interface | Yetkinlik Arayüzü | Capability’nin Inputs/Outputs üzerinden sunduğu ability-level connection point | [26](26-capability-interfaces.md) | Inputs, Outputs, Dependency | Technical API, protocol, endpoint |
| Capability Health | Yetkinlik Sağlığı | Ability’nin mevcut ve güçlü olup olmadığına ilişkin değerlendirme boyutu | [20](20-capability-observability.md) | Maturity, Risk, Observability Surface | Runtime Health, tek KPI |
| Capability Maturity | Yetkinlik Olgunluğu | Ability’nin ne kadar gelişmiş ve yerleşik olduğunu gösteren değerlendirme boyutu | [32](32-capability-maturity.md) | Health, Risk | Performance score, maturity ladder |
| Capability Risk | Yetkinlik Riski | Ability condition ile network öneminin oluşturduğu exposure boyutu | [33](33-capability-risk.md) | Health, Maturity, Criticality | Risk matrix veya tek score |
| Capability Intelligence | Yetkinlik Zekâsı | Capability Network’ü health, maturity ve risk bağlamında anlama katmanı | [30](30-capability-intelligence.md) | Insight, Enterprise Awareness | Runtime Observability, Director Reasoning |
| Observability Surface | Gözlemlenebilirlik Yüzeyi | Capability’nin değerlendirilebilir olmasını sağlayan ability-level declaration | [20](20-capability-observability.md) | Observation Surface, Health | Dashboard, telemetry emitter |
| Observation Surface | Gözlem Yüzeyi | Capability observability declarations ile network context’in intelligence-facing toplam yüzeyi | [34](34-observation-and-insight.md) | Insight Generation | Runtime telemetry platform |
| Director Visibility | Director Görünürlüğü | Capability insight’ın Director’a ulaştığı architectural link | [21](21-capability-governance.md) | Enterprise Awareness, Governance | UI, dashboard, Source of Truth |
| Capability Realization | Yetkinlik Gerçekleştirmesi | Kalıcı Capability’nin replaceable Runtime actors tarafından operational fulfillment’ı | [38](38-capability-realization.md) | Realizer, Contract, Evidence | Capability Identity |
| Realization Contract | Gerçekleştirme Sözleşmesi | Outcome, constraint, authority, accountability ve evidence yükümlülüklerini taşıyan implementation-neutral anlaşma | [38](38-capability-realization.md) | Execution Envelope, Attachment | API contract, workflow |
| Runtime Realization | Çalışma Anı Gerçekleştirmesi | Authorized attachment sonrası Runtime’daki somut fulfillment | [38](38-capability-realization.md) | Runtime, Execution, Evidence | Capability definition |
| Realization Evidence | Gerçekleştirme Kanıtı | Runtime fulfillment’ın Capability beklentilerine göre yorumlanan kanıtı | [38](38-capability-realization.md) | Provenance, Capability Health | Raw telemetry, Capability identity |
| Realization Gap | Gerçekleştirme Açığı | Gerekli Capability ile mevcut viable realization arasındaki eksiklik | [38](38-capability-realization.md) | Fitness, Risk | Capability absence |
| Realization Redundancy | Gerçekleştirme Yedekliliği | Tek Capability identity altında birden fazla bağımsız realization seçeneği | [28](28-critical-capabilities.md) | SPOF, Agent Binding, Runtime | Capability duplication, “Capability Redundancy” |
| Agent–Capability Binding | Agent–Yetkinlik Bağı | Agent’ın belirli bağlamda Capability’yi realize etmeye eligible olduğunu belirten governed ilişki | [39](39-agent-capability-binding.md) | Eligibility, Provenance, Fitness | Execution Authorization |
| Binding Provenance | Bağ Kaynak İzlenebilirliği | Binding’in authority, rationale, policy basis ve evidence kaydı | [39](39-agent-capability-binding.md) | Governance, Auditability | Runtime log |
| Execution Attachment | Yürütme Bağlantısı | Authorized realization’ın bounded Runtime context’e bağlanması | [40](40-capability-execution-model.md) | Binding, Envelope, Runtime | Eligibility |
| Execution Envelope | Yürütme Zarfı | Runtime’a geçen authority, policy, constraint, accountability ve evidence sınırları | [40](40-capability-execution-model.md) | Attachment, Governance | Capability Identity |
| Runtime | Çalışma Ortamı | Authorized realization’ın operational olarak gerçekleştirildiği replaceable ortam | [37](37-ai-capability-orchestration.md) | Agent, Execution, Evidence | Capability |
| Execution | Yürütme | Authorized work’ın Runtime tarafından envelope içinde gerçekleştirilmesi | [40](40-capability-execution-model.md) | Runtime Realization, State | Dependency, Capability |
| Director Governance | Director Yönetişimi | Orchestration policy, admissibility, attachment authority ve accountability’nin Director tarafından yönetilmesi | [37](37-ai-capability-orchestration.md) | Authority, Visibility, Orchestration | Runtime Operation, scheduling |

## Canonical Distinctions

- **Capability vs Department:** what the enterprise can do vs who is accountable.
- **Capability vs Process:** what can be done vs how work is organized.
- **Capability vs Agent:** durable ability vs replaceable AI realizer.
- **Capability vs Runtime:** business identity vs operational environment.
- **Capability vs Execution:** standing ability vs transient performance.
- **Capability Health vs Runtime Health:** ability-level assessment vs operational component condition.
- **Capability Dependency vs Workflow Sequence:** structural reliance vs ordered work.
- **Capability Interface vs Technical API:** ability-level contract vs implementation surface.
- **Capability Realization vs Capability Identity:** fulfillment method vs durable meaning.
- **Binding Eligibility vs Execution Authorization:** may be considered vs is authorized now.
- **Director Governance vs Runtime Operation:** governs admissibility and authority vs performs and operates work.

## Terminology Decision

“Capability Redundancy” is not a canonical Phase 10 concept and may appear only to identify an anti-pattern. The canonical resilience term is **Realization Redundancy**.
