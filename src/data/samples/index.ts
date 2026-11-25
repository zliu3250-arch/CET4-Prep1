import type {
  ListeningSet,
  ReadingPassage,
  TranslationItem,
  VocabItem,
  WritingPrompt,
} from '../../types/cet4';

export const SAMPLE_VOCAB: VocabItem[] = [
  {
    id: 'v-01',
    word: 'sustainable',
    phonetic: '/səˈsteɪnəbl/',
    pos: 'adj.',
    meaning: '可持续的；能维持的',
    example: 'Cities are investing in sustainable public transportation.',
    exampleCn: '各城市正在投资可持续的公共交通。',
    tags: ['高频', '环保'],
  },
  {
    id: 'v-02',
    word: 'efficiency',
    phonetic: '/ɪˈfɪʃnsi/',
    pos: 'n.',
    meaning: '效率；效能',
    example: 'Automation has greatly improved factory efficiency.',
    exampleCn: '自动化极大提高了工厂效率。',
    tags: ['高频', '科技'],
  },
  {
    id: 'v-03',
    word: 'perspective',
    phonetic: '/pəˈspektɪv/',
    pos: 'n.',
    meaning: '视角；观点；看法',
    example: 'Traveling abroad gives students a broader perspective.',
    exampleCn: '出国旅行能给学生更广阔的视野。',
    tags: ['高频', '写作'],
  },
  {
    id: 'v-04',
    word: 'essential',
    phonetic: '/ɪˈsenʃl/',
    pos: 'adj.',
    meaning: '必不可少的；极其重要的',
    example: 'Effective time management is essential for exam preparation.',
    exampleCn: '高效的时间管理对备考至关重要。',
    tags: ['高频'],
  },
  {
    id: 'v-05',
    word: 'innovation',
    phonetic: '/ˌɪnəˈveɪʃn/',
    pos: 'n.',
    meaning: '创新；革新',
    example: 'Technological innovation drives modern economic growth.',
    exampleCn: '技术创新推动现代经济增长。',
    tags: ['高频', '翻译'],
  },
  {
    id: 'v-06',
    word: 'consequence',
    phonetic: '/ˈkɒnsɪkwəns/',
    pos: 'n.',
    meaning: '结果；后果',
    example: 'Ignoring sleep can have serious consequences for your health.',
    exampleCn: '忽视睡眠会对健康造成严重后果。',
    tags: ['高频'],
  },
  {
    id: 'v-07',
    word: 'significant',
    phonetic: '/sɪɡˈnɪfɪkənt/',
    pos: 'adj.',
    meaning: '显著的；重要的；有意义的',
    example: 'There has been a significant increase in online learning.',
    exampleCn: '在线学习出现了显著增长。',
    tags: ['高频', '阅读'],
  },
  {
    id: 'v-08',
    word: 'contribute',
    phonetic: '/kənˈtrɪbjuːt/',
    pos: 'v.',
    meaning: '贡献；促成；投稿',
    example: 'Regular reading contributes to better writing skills.',
    exampleCn: '坚持阅读有助于提升写作能力。',
    tags: ['高频'],
  },
  {
    id: 'v-09',
    word: 'comprehensive',
    phonetic: '/ˌkɒmprɪˈhensɪv/',
    pos: 'adj.',
    meaning: '全面的；综合的',
    example: 'The report offers a comprehensive review of campus life.',
    exampleCn: '这份报告对校园生活进行了全面回顾。',
    tags: ['阅读'],
  },
  {
    id: 'v-10',
    word: 'opportunity',
    phonetic: '/ˌɒpəˈtjuːnəti/',
    pos: 'n.',
    meaning: '机会；时机',
    example: 'Internships provide a valuable opportunity to gain experience.',
    exampleCn: '实习提供了积累经验的宝贵机会。',
    tags: ['高频'],
  },
  {
    id: 'v-11',
    word: 'preserve',
    phonetic: '/prɪˈzɜːv/',
    pos: 'v.',
    meaning: '保护；保存；维护',
    example: 'We should preserve traditional crafts for future generations.',
    exampleCn: '我们应该为后代保护传统手工艺。',
    tags: ['翻译', '文化'],
  },
  {
    id: 'v-12',
    word: 'adapt',
    phonetic: '/əˈdæpt/',
    pos: 'v.',
    meaning: '适应；改编',
    example: 'Freshmen need time to adapt to independent college life.',
    exampleCn: '大一新生需要时间适应独立的大学生活。',
    tags: ['高频'],
  },
  {
    id: 'v-13',
    word: 'priority',
    phonetic: '/praɪˈɒrəti/',
    pos: 'n.',
    meaning: '优先事项；优先权',
    example: 'Safety should always be our top priority.',
    exampleCn: '安全应始终是我们的首要任务。',
    tags: ['高频'],
  },
  {
    id: 'v-14',
    word: 'demonstrate',
    phonetic: '/ˈdemənstreɪt/',
    pos: 'v.',
    meaning: '证明；展示；示范',
    example: 'The experiment clearly demonstrates how the system works.',
    exampleCn: '这项实验清楚地展示了该系统的工作原理。',
    tags: ['阅读'],
  },
  {
    id: 'v-15',
    word: 'enthusiasm',
    phonetic: '/ɪnˈθjuːziæzəm/',
    pos: 'n.',
    meaning: '热情；热忱',
    example: 'Students showed great enthusiasm for the volunteer program.',
    exampleCn: '学生们对志愿项目表现出极大的热情。',
    tags: ['写作'],
  },
  {
    id: 'v-16',
    word: 'potential',
    phonetic: '/pəˈtenʃl/',
    pos: 'adj./n.',
    meaning: '潜在的；潜力',
    example: 'AI tools have huge potential in personalized education.',
    exampleCn: '人工智能工具在个性化教育中具有巨大潜力。',
    tags: ['高频', '科技'],
  },
  {
    id: 'v-17',
    word: 'alternative',
    phonetic: '/ɔːlˈtɜːnətɪv/',
    pos: 'n./adj.',
    meaning: '替代品；可供选择的',
    example: 'Cycling is a healthy alternative to driving short distances.',
    exampleCn: '骑行是短途开车的一个健康替代方式。',
    tags: ['高频'],
  },
  {
    id: 'v-18',
    word: 'maintain',
    phonetic: '/meɪnˈteɪn/',
    pos: 'v.',
    meaning: '维持；保持；保养',
    example: 'It is important to maintain a balance between study and rest.',
    exampleCn: '在学习与休息之间保持平衡非常重要。',
    tags: ['高频'],
  },
  {
    id: 'v-19',
    word: 'remarkable',
    phonetic: '/rɪˈmɑːkəbl/',
    pos: 'adj.',
    meaning: '非凡的；引人注目的',
    example: 'China has made remarkable progress in high-speed rail.',
    exampleCn: '中国在高铁领域取得了非凡的进步。',
    tags: ['翻译'],
  },
  {
    id: 'v-20',
    word: 'responsibility',
    phonetic: '/rɪˌspɒnsəˈbɪləti/',
    pos: 'n.',
    meaning: '责任；职责',
    example: 'Protecting the environment is a shared responsibility.',
    exampleCn: '保护环境是共同的责任。',
    tags: ['高频', '写作'],
  },
];

export const SAMPLE_WRITING: WritingPrompt[] = [
  {
    id: 'w-01',
    title: '大学生是否应该广泛使用 AI 工具辅助学习',
    category: '议论文',
    directions:
      'For this part, you are allowed 30 minutes to write an essay on whether college students should rely widely on AI tools in their studies. You should write at least 120 words but no more than 180 words.',
    minWords: 120,
    maxWords: 180,
    suggestedMinutes: 30,
    outlineTips: [
      '第一段：引入现象（AI 工具在校园日益普及）+ 亮明观点（善用而非依赖）。',
      '第二段：分析利弊（优势：提升检索与学习效率；隐患：削弱独立思考与学术诚信）。',
      '第三段：提出建议与总结（把 AI 当作学习助手而非替代品）。',
    ],
    usefulExpressions: [
      'play an increasingly vital role in...',
      'serve as a double-edged sword',
      'enhance learning efficiency',
      'undermine independent thinking',
      'strike a balance between A and B',
    ],
    sampleEssay: `With the rapid development of artificial intelligence, AI tools are playing an increasingly vital role in college students' daily studies. While these technologies bring undeniable convenience, I believe students should use them wisely rather than rely on them blindly.

On the one hand, AI tools can greatly enhance learning efficiency. They help students quickly summarize complex concepts, check grammar errors in essays, and practice foreign languages anytime. On the other hand, overdependence on AI acts as a double-edged sword. If students let algorithms write papers or solve every problem for them, their independent thinking and problem-solving skills will gradually decline.

Therefore, college students should strike a balance between embracing technology and preserving their own cognitive effort. Only by treating AI as a helpful assistant instead of a substitute for learning can we truly benefit from it.`,
    keyPoints: [
      '明确立场（辩证看待，切中题干）',
      '使用 On the one hand / On the other hand 清晰衔接',
      '结尾使用倒装句 Only by... can we... 提升句式多样性',
    ],
  },
  {
    id: 'w-02',
    title: '给图书馆写一封关于延长开放时间的建议信',
    category: '应用文',
    directions:
      'Suppose your university library is collecting suggestions from students. Write a letter to the library director proposing to extend the opening hours during exam weeks. Write 120 to 180 words.',
    minWords: 120,
    maxWords: 180,
    suggestedMinutes: 30,
    outlineTips: [
      '称呼与开篇：礼貌说明写信目的（考试周延长开放时间的建议）。',
      '正文理由：1）晚间自习需求激增，宿舍环境较嘈杂；2）可仅开放部分自习区并采用刷卡/志愿值班降低成本。',
      '结尾落款：表达感谢并期待回复。',
    ],
    usefulExpressions: [
      'I am writing to put forward a suggestion regarding...',
      'create a quiet and focused atmosphere',
      'meet the growing demand of students',
      'take my proposal into consideration',
    ],
    sampleEssay: `Dear Library Director,

I am a sophomore at our university, and I am writing to put forward a suggestion regarding extending the library's opening hours during final exam weeks.

Currently, the library closes at 10:00 p.m., which feels a bit early for many students who prefer studying late at night. Dormitories are often noisy and distracting, making it difficult to concentrate. Extending the closing time to 11:30 p.m. during the two weeks before finals would provide a quiet and focused atmosphere and greatly ease students' exam pressure.

To minimize staffing costs, the library could keep only one or two self-study halls open and recruit student volunteers to assist with management.

Thank you for your time and dedication. I would appreciate it if you could take my proposal into consideration.

Yours sincerely,
Li Ming`,
    keyPoints: [
      '具备标准书信格式（Dear... / Yours sincerely）',
      '不仅提需求，还给出可行性方案（仅开部分区域+志愿者）',
      '语气礼貌得体，符合四级应用文要求',
    ],
  },
];

export const SAMPLE_TRANSLATION: TranslationItem[] = [
  {
    id: 't-01',
    title: '中国的移动支付与智慧生活',
    topic: '社会科技',
    suggestedMinutes: 30,
    sourceText:
      '近年来，移动支付在中国得到了广泛普及。无论是大型商场还是街边小店，人们只需拿出手机扫一扫二维码，就能在几秒钟内完成付款。这种便捷的支付方式不仅改变了人们的日常消费习惯，也极大地推动了数字经济的发展。',
    hints: [
      { zh: '得到广泛普及', en: 'become widely popular / gain widespread popularity' },
      { zh: '扫一扫二维码', en: 'scan a QR code' },
      { zh: '日常消费习惯', en: 'daily consumption habits' },
      { zh: '数字经济', en: 'the digital economy' },
    ],
    referenceTranslation:
      'In recent years, mobile payment has gained widespread popularity in China. Whether in large shopping malls or small street-side shops, people only need to take out their smartphones and scan a QR code to complete a payment within seconds. This convenient payment method has not only changed people\'s daily consumption habits, but also greatly promoted the development of the digital economy.',
    keyPhrases: [
      'In recent years',
      'Whether in... or...',
      'scan a QR code',
      'not only... but also...',
      'promote the development of the digital economy',
    ],
  },
  {
    id: 't-02',
    title: '中国茶文化',
    topic: '传统文化',
    suggestedMinutes: 30,
    sourceText:
      '中国是茶的故乡，拥有数千年的饮茶历史。茶不仅是一种受欢迎的日常饮品，也是中国传统文化的重要象征。每逢亲友来访，中国人通常会泡上一壶热茶以示欢迎和尊重。如今，越来越多的年轻人也开始喜欢上品茶。',
    hints: [
      { zh: '……的故乡', en: 'the birthplace / home of...' },
      { zh: '重要象征', en: 'an important symbol of' },
      { zh: '泡一壶热茶', en: 'brew a pot of hot tea' },
      { zh: '以示欢迎和尊重', en: 'to show welcome and respect' },
    ],
    referenceTranslation:
      'China is the birthplace of tea, boasting a history of tea drinking that spans thousands of years. Tea is not only a popular daily beverage, but also an important symbol of traditional Chinese culture. Whenever relatives or friends visit, Chinese people usually brew a pot of hot tea to show welcome and respect. Nowadays, an increasing number of young people are also beginning to enjoy tasting tea.',
    keyPhrases: [
      'the birthplace of tea',
      'a popular daily beverage',
      'brew a pot of hot tea',
      'an increasing number of',
    ],
  },
];

export const SAMPLE_READING: ReadingPassage[] = [
  {
    id: 'r-01',
    title: 'Why Taking Short Breaks Boosts Study Efficiency',
    type: 'careful',
    suggestedMinutes: 12,
    paragraphs: [
      {
        label: '1',
        text: 'Many college students believe that studying for five hours without stopping is the fastest way to prepare for exams. However, cognitive psychologists have repeatedly found that prolonged, unbroken concentration often leads to mental fatigue and declining memory retention.',
      },
      {
        label: '2',
        text: 'When the brain processes new vocabulary or complex formulas continuously, neural resources become temporarily depleted. Taking a structured 5-to-10-minute break every 40 minutes gives the brain time to consolidate fresh information into long-term memory.',
      },
      {
        label: '3',
        text: 'Yet not all breaks are equally effective. Scrolling endlessly through short videos keeps the mind overstimulated and makes it harder to return to study mode. By contrast, stretching, drinking water, or taking a brief walk outdoors restores attention far more efficiently.',
      },
    ],
    questions: [
      {
        id: 'r-01-q1',
        number: 1,
        stem: 'What do cognitive psychologists say about studying for hours without stopping?',
        options: [
          { label: 'A', text: 'It is the most reliable method before final exams.' },
          { label: 'B', text: 'It causes mental fatigue and weakens memory retention.' },
          { label: 'C', text: 'It works better for vocabulary than for math formulas.' },
          { label: 'D', text: 'It helps students enter long-term memory mode faster.' },
        ],
        answer: 'B',
        explanation: '第一段第二句明确指出，长时间不间断专注会导致精神疲劳（mental fatigue）和记忆保持率下降（declining memory retention）。',
        locateHint: '第 1 段第 2 句',
      },
      {
        id: 'r-01-q2',
        number: 2,
        stem: 'According to Paragraph 2, why is a short break helpful after 40 minutes of study?',
        options: [
          { label: 'A', text: 'It allows the brain to consolidate new information.' },
          { label: 'B', text: 'It reduces the total number of formulas students must learn.' },
          { label: 'C', text: 'It completely eliminates the need for review later.' },
          { label: 'D', text: 'It increases screen time tolerance.' },
        ],
        answer: 'A',
        explanation: '第二段提到每学习 40 分钟休息 5~10 分钟可以让大脑把新信息巩固进长期记忆（consolidate fresh information into long-term memory）。',
        locateHint: '第 2 段第 2 句',
      },
      {
        id: 'r-01-q3',
        number: 3,
        stem: 'Which break activity is LEAST recommended by the author?',
        options: [
          { label: 'A', text: 'Stretching in the room' },
          { label: 'B', text: 'Drinking a glass of water' },
          { label: 'C', text: 'Scrolling through short videos' },
          { label: 'D', text: 'Taking a short walk outside' },
        ],
        answer: 'C',
        explanation: '第三段指出刷短视频会让大脑过度兴奋（overstimulated），更难回到学习状态。',
        locateHint: '第 3 段第 2 句',
      },
    ],
  },
  {
    id: 'r-02',
    title: 'Green Campuses and Student Habits（选词填空示例）',
    type: 'banked_cloze',
    suggestedMinutes: 8,
    paragraphs: [
      {
        label: '1',
        text: 'Universities across the country are launching green initiatives to [1] energy waste. Dining halls now encourage students to bring reusable cups and offer small discounts as an [2]. Meanwhile, student clubs organize weekend workshops to raise environmental [3] among freshmen.',
      },
    ],
    wordBank: [
      { label: 'A', word: 'reduce' },
      { label: 'B', word: 'incentive' },
      { label: 'C', word: 'awareness' },
      { label: 'D', word: 'ignore' },
      { label: 'E', word: 'expensive' },
    ],
    questions: [
      {
        id: 'r-02-q1',
        number: 1,
        stem: '空 [1] 处应填入哪个词？',
        options: [
          { label: 'A', text: 'reduce' },
          { label: 'B', text: 'incentive' },
          { label: 'C', text: 'awareness' },
          { label: 'D', text: 'ignore' },
          { label: 'E', text: 'expensive' },
        ],
        answer: 'A',
        explanation: 'to 后接动词原形，发起绿色倡议是为了“减少（reduce）”能源浪费。',
        locateHint: '第 1 句 to [1] energy waste',
      },
      {
        id: 'r-02-q2',
        number: 2,
        stem: '空 [2] 处应填入哪个词？',
        options: [
          { label: 'A', text: 'reduce' },
          { label: 'B', text: 'incentive' },
          { label: 'C', text: 'awareness' },
          { label: 'D', text: 'ignore' },
          { label: 'E', text: 'expensive' },
        ],
        answer: 'B',
        explanation: 'an 后接元音开头的可数名词单数，提供小折扣作为一种“激励（incentive）”。',
        locateHint: '第 2 句 as an [2]',
      },
      {
        id: 'r-02-q3',
        number: 3,
        stem: '空 [3] 处应填入哪个词？',
        options: [
          { label: 'A', text: 'reduce' },
          { label: 'B', text: 'incentive' },
          { label: 'C', text: 'awareness' },
          { label: 'D', text: 'ignore' },
          { label: 'E', text: 'expensive' },
        ],
        answer: 'C',
        explanation: '固定搭配 raise environmental awareness（提高环保意识）。',
        locateHint: '第 3 句 raise environmental [3]',
      },
    ],
  },
];

export const SAMPLE_LISTENING: ListeningSet[] = [
  {
    id: 'l-01',
    title: '校园长对话：备考学习小组安排',
    section: '长对话',
    transcript: [
      {
        speaker: 'Woman',
        text: 'Hi Mark, are you still planning to join our CET-4 study group this Saturday morning?',
      },
      {
        speaker: 'Man',
        text: 'Definitely. I really need help with listening and reading speed. Where are we meeting?',
      },
      {
        speaker: 'Woman',
        text: 'We booked discussion room 302 in the main library from nine to eleven. Bring a set of practice questions if you have one.',
      },
      {
        speaker: 'Man',
        text: 'Got it. Should I review vocabulary before coming?',
      },
      {
        speaker: 'Woman',
        text: 'Yes, we will start with a ten-minute spelling warm-up before doing a timed reading passage.',
      },
    ],
    questions: [
      {
        id: 'l-01-q1',
        number: 1,
        stem: 'What skills does Mark say he needs help with?',
        options: [
          { label: 'A', text: 'Writing essays and grammar' },
          { label: 'B', text: 'Listening and reading speed' },
          { label: 'C', text: 'Pronunciation and speaking' },
          { label: 'D', text: 'Translation and handwriting' },
        ],
        answer: 'B',
        explanation: '男士明确说到：I really need help with listening and reading speed.',
      },
      {
        id: 'l-01-q2',
        number: 2,
        stem: 'Where will the study group meet on Saturday?',
        options: [
          { label: 'A', text: 'In the student cafeteria' },
          { label: 'B', text: 'In classroom 203' },
          { label: 'C', text: 'In discussion room 302 of the main library' },
          { label: 'D', text: 'Online via video call' },
        ],
        answer: 'C',
        explanation: '女士提到：We booked discussion room 302 in the main library from nine to eleven.',
      },
      {
        id: 'l-01-q3',
        number: 3,
        stem: 'How will the group begin their study session?',
        options: [
          { label: 'A', text: 'With a ten-minute spelling warm-up' },
          { label: 'B', text: 'With a full mock exam' },
          { label: 'C', text: 'By watching an English movie' },
          { label: 'D', text: 'By translating a news report' },
        ],
        answer: 'A',
        explanation: '女士最后一句说：we will start with a ten-minute spelling warm-up before doing a timed reading passage.',
      },
    ],
  },
];
