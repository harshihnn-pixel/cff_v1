// Company Formation Framework content.
// Point format: [title, explanation, question1, question2, flag]
// flag "values" = opens the 13-question Values Assessment; "link-values" = shows a shortcut to it.

const INTRO = {
  title: "Company Formation Framework",
  subtitle: "From Business Idea to Successful Company",
  paragraphs: [
    "A company is born from a business idea. Just as a person needs a vehicle, a destination, and a roadmap to complete a journey, a company also requires the right foundation, planning, resources, and execution to reach its ultimate vision.",
    "Think of building a company like traveling to a destination in a car."
  ],
  journey: [
    ["Car", "Investment & Business Resources"],
    ["Driver", "Founders / Partners"],
    ["Destination", "Vision & End Goal"],
    ["Experience", "Founders' Knowledge & Past Experience"],
    ["Fuel", "Passion, Energy & Spiritual Strength"],
    ["Problem Solving", "Expertise & Decision Making"],
    ["Road Map", "Business Strategy & Growth Plan"],
    ["Organization", "Execution & Operations"]
  ],
  closing: "A successful company requires all these elements working together.",
  summary: "This framework provides a logical, end-to-end roadmap from a business idea to a scalable, legally compliant, value-driven company. It starts with defining the purpose and founders, builds the business structure and brand identity, establishes legal and operational systems, and ends with continuous improvement and long-term growth."
};

const VALUE_QUESTIONS = [
  "How do you fill your space?",
  "How do you spend your time?",
  "How do you spend your energy?",
  "How do you spend your money?",
  "Where are you most organized?",
  "Where are you most reliable?",
  "What dominates your thoughts?",
  "What do you visualize most?",
  "What do you most often talk to yourself about?",
  "What do you most often talk to others about?",
  "What inspires you?",
  "What goals stand out in your life and have stood the test of time? (Top 3 goals in your life)",
  "What topics do you have to study, read about, or research?"
];

const STAGES = [
  {
    n: 1, title: "Business Foundation", flow: "Business Foundation (Idea, Vision & Purpose)",
    intro: "Everything begins with a business idea. Before starting a company, define the nine points below. Together they become the foundation of the company, and every later stage is built on top of them.",
    groups: [{ name: "Define before starting", points: [
      ["Business Idea", "The core offering in one or two sentences: what the company will sell or provide, to whom, and why it will work.", "What exactly will the company sell or provide?", "Why are you the right people to build this?"],
      ["Vision", "The picture of the future the company is working toward, usually ten or more years away. It gives everyone a shared direction.", "What will the world look like if the company succeeds?", "How would you describe the company in ten years?"],
      ["Mission", "What the company does every day to move toward the vision. It is practical and written in the present tense.", "What do we do, for whom, and how?", "What will we never compromise on while doing it?"],
      ["End Goal", "The measurable finish line of the journey. It tells everyone when the company has arrived.", "What specific result means we have reached our goal?", "By when do we want to reach it?"],
      ["Purpose of the Company", "The reason the company exists beyond making money. Purpose keeps the founders going when the work gets hard.", "Why does this company need to exist?", "What would be lost if it never started?"],
      ["Problem being solved", "The specific pain customers face today. A clearly defined problem makes every later decision easier.", "Who faces this problem, and how often?", "How are they solving it today, and what is wrong with that?"],
      ["Customer need", "What customers actually want and are willing to pay for, described in their own words.", "What does the customer want to feel or achieve?", "What would make them choose us over the alternatives?"],
      ["Long-term impact", "The lasting change the company will create for customers, employees and society.", "What changes in people's lives because of us?", "What impact do we want to see after twenty years?"],
      ["Company's destination", "Where the company is finally heading: its position in the market and in society. This is the destination on the road map.", "Where do we want the company to stand when the journey is complete?", "What do we want the company to be known for?"]
    ]}]
  },
  {
    n: 2, title: "Complete Business Process", flow: "Complete Business Process Design",
    intro: "Design the complete business process before starting operations. Create the entire journey from the business idea to the long-term vision, and document every stage.",
    sequence: ["Business Idea", "Product/Service Creation", "Customer Acquisition", "Customer Experience", "Business Operations", "Growth", "Expansion", "Long-Term Vision"],
    groups: [{ name: "The process should include", points: [
      ["Customer Journey", "Every step a customer takes, from first hearing about the company to buying, using the product and coming back or referring others.", "How does a customer first find us, and what do they do next?", "What happens after they buy?"],
      ["Company Journey", "The path the company takes through each stage of the flow above, and what must be true before it moves to the next stage.", "Which stage of the flow is the company in today?", "What must be achieved before moving to the next stage?"],
      ["Internal Process", "How work moves inside the company: between partners, departments and team members.", "How does a task move from one person or team to the next?", "Where could work get stuck or duplicated?"],
      ["External Process", "How the company works with outside parties such as customers, vendors, partners, banks and government bodies.", "Which outside parties do we depend on?", "How do we communicate and hand over work with each of them?"],
      ["Operational Workflow", "The day-to-day, step-by-step routine that delivers the product or service consistently every time.", "What are the steps to deliver one order or service from start to finish?", "Which steps can be standardised or automated?"],
      ["Decision-making Flow", "Who decides what, how decisions are escalated, and how disagreements are resolved.", "Which decisions need all partners, and which can one person take?", "How will we resolve a disagreement between partners?"],
      ["Stage-wise Growth Plan", "What the company will do at each stage of growth, and the signals that show it is ready for the next stage.", "What does growth look like in year 1, year 3 and year 5?", "Which numbers tell us we are ready to grow further?"]
    ]}]
  },
  {
    n: 3, title: "Company Resources Assessment", flow: "Company Resources Assessment",
    intro: "Before starting the company, identify all available resources. The partners, their life experience and their vision become the company's core resources.",
    groups: [
      { name: "Partner Resources", note: "Evaluate each partner based on these points.", points: [
        ["Values", "The beliefs that decide what each partner gives priority to. Values shape every decision the company makes. Answer the 13 questions that reveal your highest values.", "", "", "values"],
        ["Knowledge", "What each partner knows: subject knowledge, market understanding and education.", "Which subjects does each partner know deeply?", "What knowledge is missing in the team?"],
        ["Skills", "The practical abilities each partner can use immediately, such as selling, planning, building or managing.", "What can each partner do well today?", "Which skills will we need to hire or learn?"],
        ["Expertise", "Areas where a partner is a recognised specialist and can make expert decisions.", "In which area is each partner an expert?", "Who will people come to for advice, and on what?"],
        ["Experience", "The years and kinds of work each partner has done, and in which industries.", "How many years of relevant experience does each partner have?", "Which past roles are most useful for this company?"],
        ["Strengths", "What each partner does better than most people, and does naturally.", "What do others praise each partner for?", "How will the company use each partner's strengths?"],
        ["Talents", "Natural gifts such as creativity, communication, analysis or relationship building.", "What comes easily to each partner?", "Which talent will make the biggest difference in this business?"],
        ["Industry Exposure", "How well each partner knows the target industry: its players, trends and regulations.", "Which companies and people in the industry does each partner know?", "Which industry trends will affect us?"],
        ["Professional Network", "The people each partner can reach: customers, mentors, investors, suppliers and officials.", "Who can each partner call for help today?", "Which contacts can bring our first customers?"],
        ["Financial Contribution", "The money each partner can invest now and later, and on what terms.", "How much can each partner invest now?", "How much more can be invested later, and when?"],
        ["Time Commitment", "The hours each partner can give every week, and for how long.", "How many hours per week can each partner give?", "Is each partner full-time or part-time, and for how long?"]
      ]},
      { name: "Life Experience", note: "Document these for each partner.", points: [
        ["Past Challenges", "Difficult situations each partner has faced in life and work, and how they handled them.", "What were the hardest situations you have faced?", "How did you get through them?"],
        ["Problems Solved", "Real problems each partner has already solved. They prove ability better than any claim.", "Which problems have you solved for others?", "Which of those solutions can this company use?"],
        ["Major Achievements", "The results each partner is most proud of.", "What are your top three achievements?", "What did each achievement teach you?"],
        ["Failures", "Things that did not work out. Honest failures show where the company must be careful.", "What failed, and why?", "What would you do differently now?"],
        ["Lessons Learned", "The principles each partner has taken from both success and failure.", "What are the most important lessons life has taught you?", "Which lesson should guide this company?"],
        ["Leadership Experience", "Times each partner has led people, projects or teams.", "Which teams or projects have you led?", "What kind of leader are you under pressure?"]
      ]},
      { name: "Vision", note: "Define these for each partner.", points: [
        ["Individual Life Goals", "What each partner wants to achieve in life, beyond the company.", "What do you want to achieve in the next ten years?", "How does this company help you reach those goals?"],
        ["Purpose", "The deeper reason each partner is doing this work.", "Why are you starting this company?", "What gives your work meaning?"],
        ["Intentions to Serve Society", "How each partner wants to help people and communities through the business.", "Which group of people do you most want to help?", "How will the company serve society?"],
        ["Long-term Vision", "Where each partner sees themselves and the company in the long run.", "Where do you see yourself in twenty years?", "What role do you want in the company at that time?"],
        ["Personal Desires", "What each partner personally wants from the journey: income, freedom, recognition, learning.", "What do you personally want to gain from this company?", "What are you not willing to give up?"],
        ["Opportunities Available", "Openings in the market, network or timing that the partners can use right now.", "What opportunities are open to us today?", "Why is now the right time?"]
      ]}
    ],
    closing: "These become the company's core resources."
  },
  {
    n: 4, title: "Individual Partner Profile Creation", flow: "Individual Partner Profile Creation",
    intro: "Create a complete profile for every partner. This profile becomes the identity of each founder.",
    groups: [
      { name: "Personal Journey", points: [
        ["Life Story", "The key events and people that shaped who you are.", "Which moments changed the direction of your life?", "Who influenced you the most?"],
        ["Career Journey", "The path of your working life, from your first job to today.", "What roles have you held, and why did you move between them?", "What is the common thread in your career?"],
        ["Professional Experience", "The specific work, projects and responsibilities you have handled.", "Which projects are you most proud of?", "What responsibilities have you carried?"],
        ["Entrepreneurial Journey", "Your experience of starting or running businesses, big or small.", "What have you started or built before?", "What did your earlier ventures teach you?"]
      ]},
      { name: "Core Values", points: [
        ["Personal Values", "The beliefs that guide your personal life. Your Values Assessment answers are the best starting point.", "Which values do your 13 answers keep pointing to?", "Which value will you never compromise?", "link-values"],
        ["Professional Values", "The principles you follow at work, with customers, colleagues and money.", "How do you want to be known at work?", "Which workplace behaviour do you not accept?"],
        ["Leadership Style", "How you lead people: directing, coaching, supporting or delegating.", "How do you get the best out of people?", "How do people describe you as a leader?"],
        ["Decision-making Style", "How you make decisions: quickly or carefully, with data or instinct, alone or with others.", "How do you usually make big decisions?", "What do you do when you are unsure?"]
      ]},
      { name: "Expertise", points: [
        ["Industry Knowledge", "What you know about the industry the company will work in.", "Which parts of the industry do you understand best?", "Where is your industry knowledge weak?"],
        ["Technical Skills", "The tools, systems and technical abilities you have.", "Which technical skills do you use daily?", "Which technical skills will the company depend on you for?"],
        ["Business Skills", "Abilities like sales, finance, negotiation, planning and management.", "Which business skills are your strongest?", "Which business skills do you want to build?"],
        ["Specialized Expertise", "The one area where you go deeper than almost anyone else.", "What are you the go-to person for?", "How will this expertise give the company an advantage?"]
      ]},
      { name: "Experience", points: [
        ["Success Stories", "Specific stories of things that went well because of you.", "Tell one story where your work made a clear difference.", "What made that success possible?"],
        ["Challenges Faced", "Hard situations you have worked through.", "What was the toughest challenge in your career?", "How did it change you?"],
        ["Problems Solved", "Problems you have fixed for employers, clients or yourself.", "Which problem are you proudest of solving?", "What method did you use?"],
        ["Failures", "What went wrong, told honestly.", "What was your biggest failure?", "What would you do differently?"],
        ["Learnings", "What your experience has taught you that you bring into this company.", "What are your top three learnings?", "How will they shape how you work here?"]
      ]},
      { name: "Vision", points: [
        ["Personal Goals", "What you want to achieve personally in the coming years.", "What are your goals for the next five years?", "How will you measure them?"],
        ["Future Aspirations", "Who you want to become and what you want to be doing in the future.", "What do you want to be doing in ten years?", "What kind of person do you want to become?"],
        ["Life Mission", "The one thing you feel you are meant to do with your life.", "What do you feel you are here to do?", "How does this company fit that mission?"],
        ["Purpose", "Why you do what you do.", "What gets you out of bed every morning?", "What makes your work meaningful?"]
      ]},
      { name: "Motivation", points: [
        ["Inspirations", "People, stories or experiences that inspire you.", "Who inspires you, and why?", "Which story do you return to when you need motivation?"],
        ["Passion", "What you love doing so much that you would do it without being paid.", "What could you work on for hours without getting tired?", "How does this business connect to that passion?"],
        ["Dream", "The biggest dream you hold for your life and work.", "If nothing could stop you, what would you build?", "How close does this company take you to that dream?"],
        ["\"Why\" behind the journey", "The personal reason behind starting this journey. Your why keeps you going when things get hard.", "Why are you really doing this?", "What will keep you going on a bad day?"]
      ]},
      { name: "Contribution", points: [
        ["What they want to contribute to society", "The difference you want to make in people's lives.", "Who do you want to help?", "What change do you want to see because of your work?"],
        ["What value they want to create", "The value you want to create for customers, team members and partners.", "What will customers gain from your work?", "What will your team gain from working with you?"],
        ["Legacy they want to leave", "What you want to be remembered for after the journey.", "What do you want people to say about you in thirty years?", "What will you leave behind?"]
      ]}
    ],
    closing: "This profile becomes the identity of each founder."
  },
  {
    n: 5, title: "Company Structure & Growth Roadmap", flow: "Company Structure & Growth Roadmap",
    intro: "Now combine everything together. Connect the business idea, partner profiles, resources and process, then define the complete roadmap, the structure and how ownership is decided.",
    groups: [
      { name: "Connect", points: [
        ["Business Idea", "Bring forward the business idea from Stage 1 and check it still fits the partners and resources.", "Does the idea still match what the partners can deliver?", "What has changed in the idea since Stage 1?"],
        ["Partner Profiles", "Use the partner profiles from Stage 4 to see who fits where.", "Which partner is best suited to which part of the business?", "Where do partner strengths overlap or leave gaps?"],
        ["Resources", "Use the resources assessed in Stage 3: money, time, skills and network.", "Are our resources enough for the first stage?", "Which resource is the biggest constraint?"],
        ["Company Process", "Link the business process from Stage 2 to real people and teams.", "Who owns each step of the process?", "Which steps have no owner yet?"],
        ["Customer Journey", "Make sure each step of the customer journey has someone responsible for it.", "Who handles the customer at each step?", "Where could a customer be dropped or lost?"],
        ["End Goal", "Keep the end goal from Stage 1 at the centre of the roadmap.", "Does the roadmap lead clearly to the end goal?", "What milestones sit between today and the end goal?"]
      ]},
      { name: "Define the roadmap", points: [
        ["Business Stages", "The main stages the business moves through, such as launch, traction, scale and maturity.", "What are the stages of our business?", "What must be achieved in each stage?"],
        ["Company Growth Stages", "How the organisation itself grows: team size, offices, systems and capital.", "How big will the team be at each stage?", "What systems will each stage need?"],
        ["Responsibilities", "What each partner and team is responsible for delivering.", "What is each partner responsible for?", "Which responsibilities are shared, and how?"],
        ["Ownership", "Who owns each area of the business and its results.", "Who owns sales, operations, finance and product?", "How will ownership change as the company grows?"],
        ["Decision-making Authority", "Which decisions each person can make alone, and which need approval.", "What spending or hiring decisions can each partner make alone?", "Which decisions need all partners?"],
        ["Individual Contributions", "What each partner brings: money, time, skills, network or ideas.", "What is each partner contributing, in detail?", "How will contributions be tracked over time?"],
        ["Department Structure", "The departments the company will have, and when each will be set up.", "Which departments do we need now, and which later?", "Who will lead each department?"],
        ["Partner Roles", "The formal title and role of each partner.", "What is each partner's title and role?", "How are roles different from each other?"],
        ["Shareholding Structure", "How shares are divided between partners and any investors.", "How will shares be split between partners?", "How much equity is kept for future investors or employees?"],
        ["Accountability Matrix", "A clear table of who is Responsible, Accountable, Consulted and Informed for each key activity.", "Who is accountable for each key result?", "How will we review accountability?"]
      ]},
      { name: "Ownership should be decided based on", points: [
        ["Contribution", "Ownership reflects what each partner puts in: money, time, assets and ideas.", "What has each partner contributed so far?", "How do we value non-cash contributions?"],
        ["Responsibility", "Ownership reflects how much responsibility each partner carries.", "Which partner carries the most responsibility?", "How does responsibility affect shares?"],
        ["Capability", "Ownership reflects what each partner is able to deliver.", "What can each partner deliver that others cannot?", "How important is that to the company's success?"],
        ["Long-term Commitment", "Ownership reflects how long each partner will stay and work.", "How long is each partner committing to stay?", "What happens to shares if a partner leaves early?"],
        ["Value Creation", "Ownership reflects the value each partner will create in the future.", "What future value will each partner create?", "How will we reward value created later?"]
      ]}
    ]
  },
  {
    n: 6, title: "Company Values", flow: "Company Values Creation",
    intro: "Company values should not be randomly written. They should be created from the eight sources below. These values become the culture of the organization.",
    groups: [{ name: "Values are created based on", points: [
      ["Partner Values", "The personal values of the founders, revealed through the Values Assessment. Company values grow from the values the partners share.", "Which values appear in every partner's assessment?", "Which partner values must the company protect?", "link-values"],
      ["Business Purpose", "The reason the company exists (Stage 1). Values should support that purpose.", "Which values does our purpose demand?", "Which values would work against our purpose?"],
      ["Customer Promise", "What the company promises every customer. Values make that promise believable.", "What do we promise every customer?", "Which values make us keep that promise?"],
      ["Resources", "The strengths and resources the company actually has. Values should be realistic for them.", "Which values do our strengths already show?", "Can we live these values with our current resources?"],
      ["Company Vision", "The future the company is working toward. Values should lead toward it.", "Which values will take us to our vision?", "Which values will we need more of as we grow?"],
      ["Long-term Goals", "The goals the company wants to reach over many years.", "Which values help us reach our long-term goals?", "Which values keep us patient and consistent?"],
      ["Service Philosophy", "How the company believes customers should be served.", "How should a customer feel after dealing with us?", "What does great service mean for us?"],
      ["Ethical Principles", "The lines the company will never cross.", "What will we never do, even for money?", "How will we handle an ethical mistake?"]
    ]}],
    closing: "These values become the culture of the organization."
  },
  {
    n: 7, title: "Company Master Profile", flow: "Master Company Profile Development",
    intro: "Create a complete company profile using all the information collected. Use AI tools to create separate company profiles, compare all outputs, and merge the best ideas into one final Master Company Profile. This becomes the company's central knowledge base.",
    groups: [
      { name: "Create the profile with AI tools", points: [
        ["Profile in ChatGPT", "Give ChatGPT all the information collected in Stages 1 to 6 and ask it to write a complete company profile.", "Which information did you give ChatGPT?", "What were the strongest ideas in its profile?"],
        ["Profile in Claude", "Give Claude the same information and ask for a complete company profile.", "What did Claude's profile add that the others did not?", "Which parts did you like most?"],
        ["Profile in Google Gemini", "Give Google Gemini the same information and ask for a complete company profile.", "What did Gemini's profile add that the others did not?", "Which parts did you like most?"],
        ["Compare and merge", "Compare all three outputs side by side and merge the best ideas into one final Master Company Profile.", "Which ideas appeared in all three profiles?", "Which best ideas did you take from each one?"]
      ]},
      { name: "The Master Profile should include", points: [
        ["Vision", "The final, polished vision statement of the company.", "What is our final vision statement?", "Does every partner agree with it?"],
        ["Mission", "The final mission statement.", "What is our final mission statement?", "How does it guide daily work?"],
        ["Story", "The story of why and how the company started, told in a way customers can connect with.", "How did the company begin?", "What moment or problem started it all?"],
        ["Purpose", "The final statement of why the company exists.", "What is our purpose in one sentence?", "How will customers see our purpose?"],
        ["Services", "Everything the company offers, described clearly.", "What products or services do we offer?", "Which one is the main offer?"],
        ["Values", "The final company values from Stage 6.", "What are our company values?", "How does each value show up in our work?"],
        ["Target Audience", "The specific people or businesses the company serves.", "Who is our ideal customer?", "Who is not our customer?"],
        ["Positioning", "How the company wants to be seen compared with competitors.", "How are we different from others in the market?", "What single idea do we want to own in customers' minds?"],
        ["Customer Promise", "The commitment the company makes to every customer.", "What do we promise every customer?", "How will we prove it?"],
        ["Competitive Advantage", "What the company does better than competitors, and why it is hard to copy.", "What is our biggest advantage?", "Why is it difficult for others to copy?"],
        ["Brand Personality", "The human character of the brand: how it speaks, looks and behaves.", "If our brand were a person, how would you describe them?", "What tone do we use when we speak?"],
        ["Business Process", "A summary of the complete business process from Stage 2.", "What are the main steps of our business process?", "Which step is most important to get right?"]
      ]}
    ],
    closing: "This becomes the company's central knowledge base."
  },
  {
    n: 8, title: "Company Name Selection", flow: "Company Name Selection",
    intro: "Choose a unique company name. Check it against the qualities below, verify it is available everywhere before finalizing, and use one consistent name across all platforms.",
    groups: [
      { name: "The name should", points: [
        ["Match the company values", "The name should feel in line with the company values from Stage 6.", "Which values does the name reflect?", "Does anything in the name conflict with our values?"],
        ["Reflect the business purpose", "The name should hint at why the company exists or what it does.", "How does the name connect to our purpose?", "Would a customer understand what we do from the name?"],
        ["Represent the company's identity", "The name should feel like the company described in the Master Profile.", "Does the name match our brand personality?", "Would the partners be proud to say it?"],
        ["Be meaningful", "The name should have a real meaning or story behind it.", "What does the name mean?", "What is the story behind it?"],
        ["Be memorable", "The name should be easy to say, spell and remember.", "Can people spell it after hearing it once?", "Is it short and easy to say?"],
        ["Connect emotionally with customers", "The name should create a positive feeling for the customer.", "What feeling does the name create?", "How did test customers react to it?"]
      ]},
      { name: "Before finalizing, verify", points: [
        ["Domain availability", "Check that a matching website domain is available.", "Which domains are available (.com, .in, others)?", "Which one will we register?"],
        ["Social media username availability", "Check that the same username is free on the main social platforms.", "Is the username free on Instagram, LinkedIn, Facebook, YouTube and X?", "Which username will we use everywhere?"],
        ["Trademark availability", "Search trademark records to make sure no one else has registered the name in your class.", "Did the trademark search show any conflicts?", "In which trademark classes will we file?"],
        ["Legal availability", "Check the name is available for company registration with the registrar.", "Is the name available for registration?", "What backup names do we have?"]
      ]}
    ],
    closing: "Use one consistent name across all platforms."
  },
  {
    n: 9, title: "Logo Creation", flow: "Logo & Brand Identity Creation",
    intro: "The logo should represent the company's identity. It should reflect the ten points below, and every element of the logo should have a meaningful explanation.",
    groups: [{ name: "The logo should reflect", points: [
      ["Company Name", "The logo should carry the company name clearly and in a way that fits it.", "How is the name shown in the logo?", "Is the name readable at small sizes?"],
      ["Company Values", "Shapes, colors or symbols in the logo should express the company values.", "Which element of the logo shows which value?", "Does anything in the logo work against our values?"],
      ["Vision", "The logo should suggest where the company is going.", "How does the logo express our vision?", "Will the logo still fit when the company is ten times bigger?"],
      ["Mission", "The logo should connect with what the company does every day.", "How does the logo relate to our mission?", "Does it suit all our services?"],
      ["Purpose", "The logo should carry the reason the company exists.", "Which part of the logo expresses our purpose?", "Would a customer sense that purpose?"],
      ["Brand Story", "The logo should link to the story of how the company began.", "Which part of our story does the logo tell?", "How would we explain the logo in one sentence?"],
      ["Customer Connection", "The logo should feel welcoming and relevant to the target audience.", "How do customers react to the logo?", "Does it suit the audience we serve?"],
      ["Universal Color Psychology", "Colors carry meaning, such as blue for trust, green for growth and orange for energy. Choose colors for what they communicate.", "Which colors did we choose, and why?", "What feeling do those colors create?"],
      ["Brand Identity", "The logo should work together with fonts, colors and style across everything the company uses.", "Which fonts and colors go with the logo?", "Does it work on the website, signboard and visiting card?"],
      ["Company Journey", "The logo can suggest movement, growth or the path from idea to vision.", "How does the logo show our journey?", "What does each element say about where we are going?"]
    ]}],
    closing: "Every element of the logo should have a meaningful explanation."
  },
  {
    n: 10, title: "Company Planning", flow: "Company Planning & Strategy",
    intro: "Create a realistic execution plan. Plan every stage from the beginning to the end goal. The planning should focus on practical execution.",
    groups: [{ name: "The plan should include", points: [
      ["Business Launch Plan", "Everything that must be done to open for business: tasks, owners and launch date.", "What must be ready before launch?", "What is the launch date?"],
      ["Customer Journey", "The planned customer journey with the actions and tools for each step.", "What will we do at each step of the customer journey?", "Which tools or channels will we use?"],
      ["First Customer Strategy", "A specific plan to win the first paying customers.", "Who will our first ten customers be?", "How will we reach and convince them?"],
      ["Marketing Plan", "How the company will attract attention and generate interest.", "Which marketing channels will we use?", "What is the monthly marketing budget?"],
      ["Sales Plan", "How interest will be turned into paying customers.", "What is our sales process step by step?", "What are the monthly sales targets?"],
      ["Operations Plan", "How the product or service will be delivered every day.", "What resources do daily operations need?", "Who manages operations?"],
      ["Financial Plan", "Costs, revenue, cash flow and funding needs over time.", "How much money do we need until we break even?", "When will we become profitable?"],
      ["Hiring Plan", "Which people to hire, when, and at what cost.", "Which roles do we need in the first year?", "When will we hire each one?"],
      ["Growth Strategy", "How the company will grow once it is established: new customers, markets or products.", "What will drive our growth?", "Which market or product will we add next?"],
      ["Risk Management", "The main risks and how the company will prevent or handle them.", "What are our top five risks?", "What is our plan for each one?"],
      ["Milestones", "Key achievements that show the company is on track.", "What are our main milestones for the first year?", "How will we celebrate reaching them?"],
      ["Timeline", "When each part of the plan will happen.", "What happens in each month or quarter?", "Which deadlines are fixed?"],
      ["Stage-wise Execution", "The order in which the plan will be carried out, stage by stage.", "What do we do first, second and third?", "What must be finished before the next stage starts?"]
    ]}],
    closing: "The planning should focus on practical execution."
  },
  {
    n: 11, title: "Company Registration", flow: "Legal Registration & Compliance",
    intro: "After planning is complete, register the company according to legal requirements. Choose the appropriate structure, then complete all legal compliances, registrations, licenses, tax registrations and statutory requirements before operations begin.",
    groups: [
      { name: "Choose the appropriate structure", points: [
        ["Sole Proprietorship", "A business owned and run by one person, with no legal separation between owner and business. Simple to start, but the owner is personally liable.", "Is this business going to be run by one person only?", "Are you comfortable with unlimited personal liability?"],
        ["Partnership Firm", "Two or more people running a business together under a partnership deed. Easy to set up, but partners are personally liable.", "Are all partners clear on profit sharing and roles in the deed?", "Is personal liability acceptable for every partner?"],
        ["LLP", "Limited Liability Partnership: a partnership where each partner's liability is limited. Flexible to run, with fewer compliances than a company.", "Do we want partnership flexibility with limited liability?", "Do we plan to raise equity funding? (LLPs are harder to fund.)"],
        ["Private Limited Company", "A separate legal company with shareholders and directors. Best for raising investment and scaling, with more compliance.", "Do we plan to raise investment or issue shares to employees?", "Are we ready for annual audits and board compliance?"],
        ["One Person Company (OPC)", "A company with a single owner that still has limited liability and a separate legal identity.", "Will there be only one owner for now?", "Do we plan to add partners later and convert?"],
        ["LLC (where applicable)", "Limited Liability Company, the common structure in the USA and some other countries.", "Will the company operate in a country where LLCs are used?", "Which state or country will we register in?"]
      ]},
      { name: "Complete before operations begin", points: [
        ["Legal compliances", "All the rules the company must follow under company, labour and industry laws.", "Which laws apply to our business?", "Who will track compliance deadlines?"],
        ["Registrations", "Company or firm registration and any other required registrations, such as shops and establishments.", "Which registrations do we need?", "What documents are needed for each?"],
        ["Licenses", "Industry-specific licenses or permits needed to operate.", "Which licenses does our industry require?", "How long does each take to get?"],
        ["Tax registrations", "Registrations such as PAN, TAN and GST, depending on the business.", "Which tax registrations do we need?", "Who will handle filings each month?"],
        ["Statutory requirements", "Ongoing legal requirements such as bank account, auditor appointment, annual filings and employee registrations.", "What must be filed every year?", "Which professional (CA or CS) will help us?"]
      ]}
    ]
  },
  {
    n: 12, title: "Execution & Team Building", flow: "Execution, Hiring & Team Building",
    intro: "Begin execution. First decide whether the founders can manage operations alone or whether hiring is required. If hiring is needed, build the team on the company profile, values and vision so that every employee works toward one common vision.",
    groups: [
      { name: "Initially decide", points: [
        ["Can the founders manage operations alone?", "Check honestly whether the founders have the time and skills to run all operations in the first stage.", "Which tasks can the founders handle themselves?", "Where are the founders already overloaded?"],
        ["Is hiring required?", "Decide which work needs extra people, and whether to hire full-time, part-time or outsource.", "Which roles must be filled first?", "Should we hire, outsource or use freelancers?"]
      ]},
      { name: "If hiring is needed", points: [
        ["Recruit the right people", "Hire people whose values and skills match the company, not only their CV.", "What values and skills must a new hire have?", "How will we test for them in interviews?"],
        ["Train them using the company profile", "Use the Master Company Profile from Stage 7 as the main training material.", "Which parts of the profile will new hires study first?", "How long is the training period?"],
        ["Teach company values", "Make sure every person understands and practices the company values from Stage 6.", "How will we teach our values?", "How will we recognise people who live them?"],
        ["Explain the vision", "Help every employee understand where the company is going and why it matters.", "How will we explain our vision to a new hire?", "How often will we repeat it?"],
        ["Define responsibilities", "Give every role a clear list of responsibilities and results.", "What is each role responsible for?", "How will performance be measured?"],
        ["Share SOPs", "Standard Operating Procedures: written step-by-step instructions for recurring work.", "Which SOPs must be written first?", "Where will SOPs be stored and updated?"],
        ["Explain workflows", "Show how work moves between people and departments.", "How does work flow between roles?", "Who does a new hire go to for help?"],
        ["Build departments", "Group people into departments as the company grows.", "Which departments will we build first?", "Who will lead each one?"]
      ]}
    ],
    closing: "Every employee should work toward one common vision. The entire team should follow the same path, process, and company philosophy."
  },
  {
    n: 13, title: "Growth, Review & Continuous Improvement", flow: "Growth, Review & Continuous Improvement",
    intro: "Growth requires continuous monitoring. Regularly review the company's goals and performance, and upgrade the company whenever required. Continue improving until the company achieves its long-term vision.",
    groups: [
      { name: "Regularly review", points: [
        ["Goals", "Check progress against the company's goals.", "Which goals are on track, and which are behind?", "Do any goals need to change?"],
        ["Targets", "Compare actual numbers with targets for sales, customers and revenue.", "Did we meet this period's targets?", "What caused any gap?"],
        ["KPIs", "Key Performance Indicators: the few numbers that best show the health of the business.", "Which five KPIs matter most for us?", "How often will we review them?"],
        ["Timelines", "Check whether work is happening on schedule.", "Which deadlines were missed?", "What will we change to stay on schedule?"],
        ["Performance", "Review the performance of teams, partners and processes.", "Who or what performed best this period?", "Where is performance weakest?"],
        ["Customer Feedback", "Collect and act on what customers say.", "What are customers praising and complaining about?", "What will we change because of their feedback?"],
        ["Business Challenges", "Identify the problems holding the company back.", "What are our biggest challenges right now?", "What is our plan for each?"]
      ]},
      { name: "Upgrade the company", points: [
        ["Process Improvement", "Make processes faster, simpler and less error-prone.", "Which process causes the most delay or mistakes?", "How can we simplify it?"],
        ["Technology Adoption", "Bring in software and tools that help the company work better.", "Which tasks would software make easier?", "Which tools will we adopt next?"],
        ["AI Integration", "Use AI tools to save time, improve decisions and serve customers better.", "Where can AI save the most time for us?", "Which AI tools will we try first?"],
        ["Automation", "Let systems handle repetitive tasks automatically.", "Which tasks are repeated every day or week?", "Which of them can be automated?"],
        ["Re-engineering", "Redesign a process from scratch when small fixes are not enough.", "Which process needs a complete redesign?", "What would it look like if we started again?"],
        ["Skill Development", "Train partners and employees in new skills the company needs.", "Which skills does the team need next?", "How will we build them?"],
        ["Innovation", "Create new products, services or ways of working.", "What new idea could open a new market?", "How will we test new ideas?"],
        ["Strategy Updates", "Update the company strategy as the market and the company change.", "What has changed in the market since our last plan?", "What should we change in our strategy?"]
      ]}
    ],
    closing: "Continue improving until the company achieves its long-term vision."
  }
];

const PORTALS = {
  business: {
    name: "Founder", label: "Founder / Company Builder Portal",
    tagline: "Build your company from idea to long-term vision, with your partners and team.",
    lens: "Work through the 13 stages for your company. Your answers build its foundation, structure, profile and plans."
  },
  employee: {
    name: "Employee", label: "Employee Portal",
    tagline: "Understand your company's vision, values and your role in it.",
    lens: "See your company's vision, mission and values, your responsibilities, tasks, KPIs and the SOPs and policies you need."
  },
  visitor: {
    name: "Visitor", label: "Visitor Portal",
    tagline: "See how CFF works and explore a demo company.",
    lens: "Explore the framework and a demo company. Nothing here is real company data."
  }
};

if(typeof module !== "undefined" && module.exports) module.exports = { INTRO, VALUE_QUESTIONS, STAGES, PORTALS };
