// Shared lists used by the website and the server: roles, statuses, partner fields,
// plan types, compliance items, document folders and the Master Profile sections.
const CATALOGS = (() => {
  const ROLES = [
    { key: "owner",    label: "Company Owner",     desc: "Full company access. Adds and removes members, approves stages, manages settings." },
    { key: "founder",  label: "Founder / Director", desc: "Edits strategic CFF information, views reports and approves sections." },
    { key: "manager",  label: "Manager",            desc: "Manages plans, tasks and KPIs, and views the CFF sections they need." },
    { key: "hr",       label: "HR",                 desc: "Manages employees, onboarding, policies, training and roles." },
    { key: "employee", label: "Employee",           desc: "Sees the vision, values, their responsibilities, tasks, KPIs and SOPs." },
    { key: "viewer",   label: "Viewer",             desc: "Read-only access to the company overview." }
  ];
  const ROLE_LABEL = Object.fromEntries(ROLES.map(r => [r.key, r.label]));
  // Which experience (dashboard + navigation) each role gets. Access to each page still follows permissions.
  // Managers and HR are NOT founders: they get their own work-focused dashboards.
  const EXPERIENCE = { owner: "business", super_admin: "business", founder: "business", manager: "operations", hr: "hr", employee: "employee", viewer: "viewer" };
  const EXPERIENCE_LABEL = { business: "Business Owner Portal", operations: "Manager · Operations", hr: "HR · People", employee: "Employee Portal", viewer: "Viewer · Read only" };
  const FOUNDER_ROLES = ["owner", "founder"];   // the Founder / Company Builder (Business) experience

  const STAGE_STATUS = {
    not_started:      { label: "Not started",        tone: "" },
    draft:            { label: "Draft",              tone: "info" },
    in_progress:      { label: "In progress",        tone: "warn" },
    ready_for_review: { label: "Ready for review",   tone: "accent" },
    approved:         { label: "Approved",           tone: "good" },
    reopened:         { label: "Reopened",           tone: "warn" }
  };

  // Stages that have a dedicated tool page, in addition to their original sub-points.
  const STAGE_TOOLS = {
    3:  { route: "company/partners",   label: "Partners & resources" },
    4:  { route: "company/partners",   label: "Partner profiles" },
    5:  { route: "company/structure",  label: "Structure & ownership" },
    6:  { route: "company/values",     label: "Company values" },
    7:  { route: "company/profile",    label: "Master profile generator" },
    8:  { route: "company/names",      label: "Name selection" },
    9:  { route: "company/brand",      label: "Brand identity center" },
    10: { route: "execution/plans",    label: "Plans" },
    11: { route: "compliance/registration", label: "Registration & compliance" },
    12: { route: "people/employees",   label: "Team, onboarding & SOPs" },
    13: { route: "execution/kpis",     label: "KPIs & reviews" }
  };

  const PARTNER_FIELDS = [
    { group: "Personal journey", fields: [["personal_journey","Personal journey"],["career_journey","Career journey"],["entrepreneurial_journey","Entrepreneurial journey"]] },
    { group: "Resources (Stage 3)", fields: [["values","Values"],["knowledge","Knowledge"],["skills","Skills"],["expertise","Expertise"],["experience","Experience"],["strengths","Strengths"],["talents","Talents"],["industry_exposure","Industry exposure"],["professional_network","Professional network"],["time_commitment","Time commitment"]] },
    { group: "Life experience", fields: [["past_challenges","Past challenges"],["problems_solved","Problems solved"],["achievements","Achievements"],["failures","Failures"],["lessons_learned","Lessons learned"],["leadership_experience","Leadership experience"]] },
    { group: "Vision and motivation", fields: [["life_goals","Life goals"],["purpose","Purpose"],["long_term_vision","Long-term vision"],["motivation","Motivation"],["passion","Passion"],["dream","Dream"]] },
    { group: "Contribution", fields: [["contribution_to_society","Contribution to society"],["legacy","Legacy"]] }
  ];
  const PARTNER_KEYS = PARTNER_FIELDS.flatMap(g => g.fields.map(f => f[0]));

  const AUTHORITY_CATEGORIES = [["strategic","Strategic"],["financial","Financial"],["operational","Operational"],["hiring","Hiring"],["marketing","Marketing"],["sales","Sales"],["legal","Legal"],["technology","Technology"]];
  const AUTHORITY_LEVELS = [["board","Board / Owners"],["executive","Executive"],["senior","Senior"],["middle","Middle"],["staff","Staff"]];
  const STANDARD_DEPARTMENTS = ["Leadership","HR","Finance","Marketing","Sales","Operations","Technology","Legal","Customer Support"];

  const PROFILE_SECTIONS = [
    ["company_name","Company name"],["story","Company story"],["vision","Vision"],["mission","Mission"],["purpose","Purpose"],
    ["problem","Problem being solved"],["customer_need","Customer need"],["services","Services / products"],["target_audience","Target audience"],
    ["positioning","Positioning"],["values","Company values"],["customer_promise","Customer promise"],["competitive_advantage","Competitive advantage"],
    ["brand_personality","Brand personality"],["business_process","Business process"],["long_term_vision","Long-term vision"],["social_contribution","Social contribution"]
  ];

  const NAME_STATUSES = [["considering","Considering"],["shortlisted","Shortlisted"],["rejected","Rejected"],["selected","Selected"]];
  const CHECK_STATUSES = [["not_checked","Not checked"],["manual_verification_required","Manual verification required"],["available","Available (checked manually)"],["taken","Taken"],["not_applicable","Not applicable"]];
  const NAME_CHECKLIST = [["domain","Domain checked"],["trademark","Trademark checked"],["legal","Legal availability checked"],["instagram","Instagram checked"],["facebook","Facebook checked"],["linkedin","LinkedIn checked"],["x","X checked"],["youtube","YouTube checked"]];

  const BRAND_FIELDS = [
    ["logo_meaning","Logo meaning"],["symbol_meaning","Symbol meaning"],["color_psychology","Colour psychology"],["primary_colors","Primary colours"],
    ["secondary_colors","Secondary colours"],["typography","Typography"],["brand_personality","Brand personality"],["brand_voice","Brand voice"],
    ["tagline","Tagline"],["usage_guidelines","Logo usage guidelines"],["brand_dos","Brand do's"],["brand_donts","Brand don'ts"]
  ];
  const BRAND_ASSETS = [["primary_logo","Primary logo"],["secondary_logo","Secondary logo"],["icon","Icon"],["monochrome_logo","Monochrome logo"],["light_logo","Logo for light backgrounds"],["dark_logo","Logo for dark backgrounds"]];

  const PLAN_TYPES = [
    ["launch","Business launch plan"],["first_customer","First customer strategy"],["marketing","Marketing plan"],["sales","Sales plan"],
    ["operations","Operations plan"],["financial","Financial plan"],["hiring","Hiring plan"],["growth","Growth strategy"],
    ["risk","Risk management"],["milestones","Milestones"],["execution","Stage-wise execution plan"]
  ];
  const PLAN_STATUSES = [["not_started","Not started"],["planned","Planned"],["in_progress","In progress"],["blocked","Blocked"],["completed","Completed"],["cancelled","Cancelled"]];
  const TASK_STATUSES = [["not_started","Not started"],["in_progress","In progress"],["blocked","Blocked"],["completed","Completed"],["cancelled","Cancelled"]];
  const PRIORITIES = [["low","Low"],["medium","Medium"],["high","High"],["critical","Critical"]];

  const COMPLIANCE_STATUSES = [["not_started","Not started"],["in_progress","In progress"],["submitted","Submitted"],["approved","Approved"],["rejected","Rejected"],["expired","Expired"],["not_applicable","Not applicable"]];
  const APPLICABILITY = [["required","Required"],["not_required","Not required"],["pending_verification","Pending verification"]];
  const COMPLIANCE_CATEGORIES = [["structure","Business structure"],["registration","Registration"],["tax","Tax"],["licence","Licences"],["agreement","Agreements"],["insurance","Insurance"],["statutory","Statutory compliance"],["other","Other"]];
  // India. General guidance only — which items apply depends on the business structure, state and industry.
  const COMPLIANCE_CATALOG = [
    ["business_structure","Business structure selection","structure","Choose between Sole Proprietorship, Partnership, LLP, Private Limited, OPC."],
    ["name_approval","Name approval (RUN / SPICe+ Part A)","registration","Reserve the company or LLP name with the Registrar."],
    ["dsc","Digital Signature Certificate (DSC)","registration","Needed by directors / designated partners to sign e-forms."],
    ["din","Director Identification Number (DIN / DPIN)","registration","Usually allotted during incorporation."],
    ["moa","Memorandum of Association (MOA)","registration","Company's objects and scope. For LLPs: LLP agreement."],
    ["aoa","Articles of Association (AOA)","registration","Internal rules of the company."],
    ["coi","Certificate of Incorporation","registration","Issued by the Registrar of Companies."],
    ["pan","PAN","tax","Permanent Account Number of the business."],
    ["tan","TAN","tax","Needed to deduct tax at source (TDS)."],
    ["gst","GST registration","tax","Required above the turnover threshold or for certain businesses."],
    ["msme","MSME / Udyam registration","registration","Optional; gives access to MSME benefits."],
    ["bank_account","Business bank account","registration","Current account in the business name."],
    ["shops_establishment","Shops & Establishment registration","licence","State law; applies to offices and shops."],
    ["professional_tax","Professional Tax registration","tax","Applies in some states."],
    ["industry_licences","Industry licences (e.g. FSSAI, trade licence)","licence","Depends on the industry and location."],
    ["epf_esi","EPF and ESI registration","statutory","Applies when employee count thresholds are met."],
    ["founders_agreement","Founders' / shareholders' agreement","agreement","Roles, equity, vesting and exit terms between partners."],
    ["employment_agreements","Employment agreements and policies","agreement","Offer letters, NDAs and HR policies."],
    ["insurance","Business insurance","insurance","Property, liability, health or other cover as needed."],
    ["auditor","Auditor appointment","statutory","Private limited companies appoint an auditor after incorporation."],
    ["annual_filings","Annual ROC filings","statutory","Annual returns and financial statements to the Registrar."],
    ["income_tax_returns","Income tax returns","tax","Yearly filing."],
    ["gst_returns","GST returns","tax","Monthly / quarterly, if registered."],
    ["compliance_calendar","Compliance calendar","statutory","Set reminders for every recurring due date."]
  ];

  const DOC_CATEGORIES = [["incorporation","Incorporation"],["legal","Legal"],["finance","Finance"],["tax","Tax"],["hr","HR"],["partner_agreements","Partner agreements"],["brand","Brand"],["marketing","Marketing"],["sales","Sales"],["operations","Operations"],["compliance","Compliance"],["sops","SOPs"],["other","Other"]];
  const DOC_ACCESS = [["everyone","Everyone in the company"],["managers","Owners, founders, managers and HR"],["founders","Owners and founders only"],["owner","Owners only"]];
  const CONTENT_KINDS = [["announcement","Announcements"],["sop","SOPs"],["policy","Policies"],["training","Training"]];

  const REVIEW_SECTIONS = [
    ["goals","Goals"],["targets","Targets"],["timelines","Timelines"],["performance","Performance"],["customer_feedback","Customer feedback"],
    ["business_challenges","Business challenges"],["process_improvement","Process improvements"],["technology_adoption","Technology adoption"],
    ["ai_integration","AI integration"],["automation","Automation opportunities"],["skill_development","Skill development"],
    ["innovation","Innovation"],["strategy_updates","Strategy updates"]
  ];

  const opt = list => Object.fromEntries(list);
  return { ROLES, ROLE_LABEL, FOUNDER_ROLES, EXPERIENCE, EXPERIENCE_LABEL, STAGE_STATUS, STAGE_TOOLS, PARTNER_FIELDS, PARTNER_KEYS, AUTHORITY_CATEGORIES, AUTHORITY_LEVELS,
    STANDARD_DEPARTMENTS, PROFILE_SECTIONS, NAME_STATUSES, CHECK_STATUSES, NAME_CHECKLIST, BRAND_FIELDS, BRAND_ASSETS, PLAN_TYPES, PLAN_STATUSES,
    TASK_STATUSES, PRIORITIES, COMPLIANCE_STATUSES, APPLICABILITY, COMPLIANCE_CATEGORIES, COMPLIANCE_CATALOG, DOC_CATEGORIES, DOC_ACCESS,
    CONTENT_KINDS, REVIEW_SECTIONS, opt };
})();

if(typeof module !== "undefined" && module.exports) module.exports = CATALOGS;
