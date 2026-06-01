// RehabCounselor AI - 職業復康訓練平台本地靜態與 Mock 數據

export const MOCK_THEORY_DATA = {
  act: {
    title: "接納承諾療法 (ACT)",
    subtitle: "心理彈性與價值引導復康",
    description: "ACT (Acceptance and Commitment Therapy) 核心在於提高「心理彈性」（Psychological Flexibility），引導案主接納不可改變的身體限制或病痛，與內在的焦慮/恐懼「認知解離」，關注當下，並圍繞其人生核心價值（如家庭、尊嚴、自我實現）採取具體承諾行動。",
    hexaflex: [
      {
        id: "acceptance",
        name: "接納 (Acceptance)",
        icon: "fa-heart",
        color: "#ff6b6b",
        desc: "主動且開放地容納自己的身體感覺、痛楚及焦慮情緒，而非耗費大量精力去逃避或對抗痛楚（例如：接納受傷後的無力感，停止強求完美復原）。",
        hk_example: "「阿強，我知道半邊身體活動受限帶給你好大挫折感，每一次痛楚都在提醒你身體的改變。我哋試下唔好逼自己立刻變返以前咁，而是先同呢份挫折感、呢份繃緊一齊坐一陣，呼吸一下，容許佢暫時存在。」",
        exercise: "「心靈擴展練習」：嘗試閉上眼，深呼吸，將注意力帶到身體最繃緊或痛楚的地方，想像用呼吸為它創造出空間，停止與它摔跤。"
      },
      {
        id: "defusion",
        name: "認知解離 (Cognitive Defusion)",
        icon: "fa-unlink",
        color: "#4dadf7",
        desc: "將自己與頭腦中的「想法/標籤」分開。不把「想法」當作「事實」，停止將自我定義為「廢人」或「無用的人」。",
        hk_example: "「阿強，當你腦海入面浮現『我已經係一個廢人』呢個諗法時，我哋試下將佢改為：『我留意到我有一個諗法，話自己係一個廢人。』你覺得後面呢句說話，同你完全信晒佢，個感覺有咩唔同？」",
        exercise: "「諗法泡泡練習」：想像腦海中的負面念頭是一串串氣球，輕輕看著它們飄過，不試圖抓住它們，也不跟它們爭辯。"
      },
      {
        id: "present_moment",
        name: "關注當下 (Contact with the Present Moment)",
        icon: "fa-compass",
        color: "#51cf66",
        desc: "將注意力帶回「此時此刻」，而不是過度沉溺於過去的健康時光，或者對未來的失業生活產生無限放大與恐懼。",
        hk_example: "「阿強，我留意到你剛才講到未來搵唔到工就非常擔心。不如我哋先帶自己返黎依家呢間房。你留意下你雙腳踩住地下嘅感覺，深呼吸，數下房入面有邊三樣藍色嘅物件？」",
        exercise: "「五官感知練習」：在焦慮時，尋找身邊：5樣能看見的、4樣能觸摸的、3樣能聽見的、2樣能聞到的、1樣能嚐到的事物。"
      },
      {
        id: "self_as_context",
        name: "以己為景 (Self-as-Context)",
        icon: "fa-user-circle",
        color: "#fcc419",
        desc: "意識到自己有一個「觀察性的自我」，它高於我們的病痛、殘疾或「失業康復者」的角色標籤。你不是你的疾病，你是那個觀察疾病的容器。",
        hk_example: "「阿強，如果我哋把人生想像成一個舞台，你的中風、手腳麻痹、恐懼、還有『小巴司機』這個身份，都只是舞台上的演員。而真正的你，是那個容納這些演員的舞台。演員會上台下台，但舞台本身一直都在，而且完好無損。」",
        exercise: "「天空與雲朵練習」：你的本質是蔚藍的天空，那些痛楚、悲傷和挫折，只是飄過的烏雲。烏雲再黑，天空依然在那裡。"
      },
      {
        id: "values",
        name: "價值澄清 (Values)",
        icon: "fa-star",
        color: "#ae3ec9",
        desc: "找出對自己真正重要的人生方向。即使身體功能改變，這些核心價值依然可以通過其他途徑實踐（例如：『照顧家庭』的價值，不一定要做司機，做其他工作同樣能賺錢養家）。",
        hk_example: "「阿強，如果拋開所有的限制，你最希望自己成為一個怎樣的爸爸和丈夫？（阿強：我想為屋企承擔，支持仔女讀書。）很好，這就是你的核心價值——『承擔與關愛家人』。即使你以後不開小巴，只要我們找到一份合適的文職或辦公室助理工作，你同樣在實踐這個重要價值，對嗎？」",
        exercise: "「墓碑誌願練習」：想像你80歲回望一生，你最希望家人或同事如何形容你是一個怎樣的人？這指向你最真實的價值觀。"
      },
      {
        id: "committed_action",
        name: "承諾行動 (Committed Action)",
        icon: "fa-running",
        color: "#20c997",
        desc: "圍繞已澄清的價值觀，制定具體、可落實、漸進式的復康或就業行動計劃，即使在面對焦慮或痛楚時依然堅持前行。",
        hk_example: "「既然『承擔家人』對你咁重要，而重投社會是必經之路。我哋一齊做個承諾：下星期，我哋一齊去登記報讀 ERB 的『辦公室助理基礎證書課程』。即使上堂時你可能會覺得尷尬或手部會累，我哋都容許呢份尷尬存在，繼續行落去，好嗎？」",
        exercise: "「SMART 微小承諾」：本週為你的價值觀制定一個 15 分鐘內能完成的微小行動，並寫在日曆上，不找藉口完成它。"
      }
    ]
  },
  mi: {
    title: "動機式訪談法 (MI)",
    subtitle: "激發案主內在的改變動機",
    description: "MI (Motivational Interviewing) 是一種以案主為中心的指導性諮商風格。在職業復康中，案主常處於『想改變但又害怕改變』的矛盾期。MI 通過 OARS 技巧，協助案主發現並解決這種矛盾，減少諮商對抗，從而自主說出『改變性談話』（Change Talk）。",
    oars_game: [
      {
        id: "q1",
        statement: "「我幾十歲先黎中風，手腳又唔靈活，點樣報讀再培訓課程啊？班後生仔實笑我慢啦，去黎都係浪費時間！」",
        options: [
          {
            type: "open_question",
            text: "「你提到擔心跟唔上同被笑，如果我哋搵一個專門為復康人士開辦、大家進度相若嘅班，你覺得會有咩唔同？」",
            feedback: "【優秀！這是開放式提問】這能引導案主去思考新的可能性，而非防衛性地說『是/否』。",
            score: 10
          },
          {
            type: "affirmation",
            text: "「阿強，雖然你覺得好難，但你今日願意黎到中心同我傾，已經證明你其實好有勇氣、好想為未來搵出路。」",
            feedback: "【出色！這是肯定（Affirmation）】真誠肯定案主的努力與勇氣，有助於建立互信並減少阻抗。",
            score: 10
          },
          {
            type: "reflective_listening",
            text: "「你覺得自己身體唔如前，好擔心去到一個新環境會顯得自己慢，好怕會引黎其他人嘅目光同尷尬。」",
            feedback: "【極佳！這是反映性傾聽（Reflective Listening）】精準反映了案主內心的恐懼與尷尬，這能讓案主感到深層次的同理。",
            score: 10
          },
          {
            type: "summary",
            text: "「聽你講，你一方面覺得再培訓好似係一條出路，但另一方面你又好顧慮自己嘅身體狀況、怕被其他人笑，覺得去上堂嘅代價好大。」",
            feedback: "【非常好！這是總結（Summary）】將案主的雙重矛盾（想去但又怕）提煉出來，清晰呈現給案主看，是MI的精髓。",
            score: 10
          },
          {
            type: "advice",
            text: "「阿強，你唔好咁悲觀啦，依家政府好多政策幫殘疾人士，再培訓班個個都係咁，無人會笑你嘅，你報左名先啦！」",
            feedback: "【不推薦：這是說教/過早給予建議】這會引發案主的防衛心理，導致他進一步為『不改變』辯護（阻抗）。",
            score: 2
          }
        ]
      },
      {
        id: "q2",
        statement: "「社工，我個仔有自閉症，我真係好想佢出來搵份工。但他成日匿喺房，同佢講多兩句就發脾氣。我真係好累，好想放棄。」 (這是案主家長的話)",
        options: [
          {
            type: "open_question",
            text: "「你為左幫個仔已經付出左好長路，真係難為你。喺目前呢個情況，你覺得有咩微小嘅改變，可以幫你減輕少少負擔？」",
            feedback: "【非常好！開放式提問】關注家長自身的照顧者壓力與微小的可行改變。",
            score: 10
          },
          {
            type: "affirmation",
            text: "「你覺得好累甚至想放棄是完全可以理解的，但這也反映了你過去付出了多麼巨大的心血。你是一個極之盡責的媽媽。」",
            feedback: "【出色！這是肯定】肯定了家長的母愛與長期的付出，緩解家長的內疚與無力感。",
            score: 10
          },
          {
            type: "reflective_listening",
            text: "「你看著兒子一直退縮，自己卻無能為力，那種心疼、無奈和長期累積的疲憊，已經令你快要支撐不住了。」",
            feedback: "【優秀！反映性傾聽】深度共情家長內心的疲倦與無奈感，能有效拉近專業關係。",
            score: 10
          },
          {
            type: "summary",
            text: "「你想幫兒子融入社會，但同時又面對他的抗拒和溝通衝突，這讓你感到筋疲力盡，甚至開始懷疑自己是不是該放手了。」",
            feedback: "【非常好！總結】清晰梳理了家長「想幫孩子但又無力」的雙重困境。",
            score: 10
          },
          {
            type: "advice",
            text: "「你唔可以放棄啊！自閉症青年如果唔趁年輕訓練，以後年紀大左仲難融入社會。你一定要堅持同他講，帶他黎我哋中心！」",
            feedback: "【不推薦：強加壓力/說教】這無視了家長已經「極度疲憊」的現狀，容易讓家長產生內疚、自責甚至疏離中心服務。",
            score: 1
          }
        ]
      },
      {
        id: "q3",
        statement: "「社工，我真係好痛，全身肌肉好似火燒咁。我連企多十五分鐘都頂唔順，點返工啊？轉文職坐得耐又係痛，我係咪成世都係咁？」 (案主 雅婷)",
        options: [
          {
            type: "reflective_listening",
            text: "「你每日都忍受住火燒咁嘅強烈痛楚，不論企定坐都避開唔到，這令你感到極之精疲力竭，甚至開始對未來有種絕望同無力感。」",
            feedback: "【極佳！反映性傾聽】精準共情了慢性痛症案主的生理痛苦與心理絕望，是建立 ACT 接納工作的關鍵第一步。",
            score: 10
          },
          {
            type: "open_question",
            text: "「痛楚確實限制左你好多活動，如果我哋暫時唔強求完全唔痛，你覺得有咩工作安排或者微小嘅伸展，可以幫你稍微應對下坐姿嘅痛？」",
            feedback: "【優秀！開放式提問】這能引導案主去思考帶著痛楚生活與適應的可能性，切合 ACT 心理彈性。",
            score: 10
          },
          {
            type: "affirmation",
            text: "「雅婷，日日面對咁難頂嘅痛楚，你依然願意行黎中心同我傾就業，這證明你其實有好強大嘅求變決心同家人承擔感。」",
            feedback: "【優秀！真誠肯定】肯定了案主在劇痛下依然前來尋求協助的動機，賦權予案主。",
            score: 10
          },
          {
            type: "summary",
            text: "「聽你講，你一方面好渴望能夠重投工作來維持家庭，但另一方面，不論是企定坐，身體嘅劇烈痛楚都令你感到無處可逃，令你極之無助。」",
            feedback: "【非常好！總結】清晰呈現了案主『想工作養家』與『身體避無可避的劇痛』之間的深層心理衝突。",
            score: 10
          },
          {
            type: "advice",
            text: "「痛症通常都係心理作用或者神經敏感，你唔好成日諗住佢啦，分下心、食少少消炎藥，坐下企下，習慣左就無事，可以返工啦。」",
            feedback: "【不推薦！否定與說教】這否定了慢性痛症（纖維肌痛症）的真實生理病理特徵，容易讓案主感到不被理解並直接中斷諮商關係。",
            score: 1
          }
        ]
      },
      {
        id: "q4",
        statement: "「社工，我真係好怕去面試……人地一見到我戴住助聽器，眼神就變左。要人重複問題兩三次，我自己都覺得自己好樣衰。」 (案主 偉杰)",
        options: [
          {
            type: "reflective_listening",
            text: "「看見面試官驚訝或者異樣嘅眼神，同埋要不斷要求對方重複，這令你感到極之難受、尷尬，甚至覺得自己尊嚴受損。」",
            feedback: "【極佳！反映性傾聽】深度共情了聽障案主在公開求職中感受到的社交挫敗感與羞恥感，非常溫暖。",
            score: 10
          },
          {
            type: "affirmation",
            text: "「雖然去面試會帶比你咁大嘅挫敗同不安，但你依然無放棄搵工嘅諗法，這表明你對自己嘅多媒體設計才華其實很有抱負。」",
            feedback: "【優秀！真誠肯定】將關注點從『身體障礙』引導回『內在才華與抱負』，重塑自我價值感。",
            score: 10
          },
          {
            type: "open_question",
            text: "「重複問題確實會令人有挫折感。如果我哋可以同友好僱主提早溝通，在第一輪面試改用 WhatsApp 或文字對答，你覺得這對你的表現會帶來甚麼幫助？」",
            feedback: "【優秀！開放式提問】這能引導案主去探索符合合理便利的嶄新求職途徑，打消社交恐懼。",
            score: 10
          },
          {
            type: "summary",
            text: "「你一方面對自己嘅多媒體設計才華好有信心，渴望被視為專業人員；但另一方面，面試時的溝通障礙同他人的異樣目光，又令你極度想退縮逃避。」",
            feedback: "【非常好！總結】精準提煉了聽障青年『渴望發揮專業』與『社交溝通障礙』之間的內在張力。",
            score: 10
          },
          {
            type: "advice",
            text: "「偉杰，你唔使介意人哋點睇啦！戴助聽器好普遍啫，你下面試前自己練多幾次大聲講嘢，面試官問咩你就點頭，人哋唔會覺得奇怪嘅。」",
            feedback: "【不推薦！無效安慰與說教】這小看了聽障者在嘈雜面試環境中的真實感官障礙，且帶有強加的社交命令，容易增加阻抗。",
            score: 2
          }
        ]
      },
      {
        id: "q5",
        statement: "「我自從上次工傷斷左手指之後，一見到部機器就手震。我老婆叫我唔好再做，但我又唔想成日靠綜援過日子，真係好矛盾……」 (工傷創傷案主)",
        options: [
          {
            type: "reflective_listening",
            text: "「上次受傷嘅陰影依然深深留喺你身體入面，一見到機器就勾起你嘅恐懼；但同時你內在又好渴望靠自己雙手自力更生，這令你非常糾結。」",
            feedback: "【極佳！反映性傾聽】深刻反映了工傷案主的創傷後恐懼（PTSD 症狀）與自我尊嚴（自力更生）之間的靈魂撕裂，共情極佳。",
            score: 10
          },
          {
            type: "affirmation",
            text: "「面對這麼大嘅工傷陰影，你今日依然願意主動黎搵我傾，這證明你內心其實好強大，非常渴望為家庭承擔責任。」",
            feedback: "【優秀！肯定】真誠肯定了案主的勇氣與家庭承擔價值，激發其內在抗逆力。",
            score: 10
          },
          {
            type: "open_question",
            text: "「上次工傷確實留下了不可磨滅嘅記號。如果我哋暫時避開大機器，轉為報讀不需要接觸危險機具嘅文職或友好物業管理課程，你覺得這對你的信心重建有咩影響？」",
            feedback: "【優秀！開放式提問】提供了一種安全的替代方向，引導案主去思考如何繞過『阻礙因素』實踐價值。",
            score: 10
          },
          {
            type: "summary",
            text: "「一方面，你內在的尊嚴告訴你必須重投社會，不想依賴社福津貼；但另一方面，上次受傷嘅強烈身體恐懼，又令你一接近職場就本能退縮。」",
            feedback: "【非常好！總結】清晰地為案主勾勒出『依賴綜援的羞恥感』與『工傷創傷的恐懼感』兩大心理矛盾面。",
            score: 10
          },
          {
            type: "advice",
            text: "「既然都斷左手指，你就聽你老婆話安心拿綜援算啦，返去工廠再整親就唔好啦，安全最緊要嘛。」",
            feedback: "【不推薦！直接勸退/消極阻斷】直接剝奪了案主自力更生的內在核心價值，會令案主產生更深重的社會無用感，完全違背復康宗旨。",
            score: 1
          }
        ]
      }
    ]
  },
  icf: {
    title: "國際功能、殘疾和健康分類 (ICF)",
    subtitle: "全人 biopsychosocial 復康評估與介入",
    description: "ICF 是世界衛生組織 (WHO) 制定的全人分類系統。它不再把殘疾僅視為個人的病理問題，而是將其看作是「身體狀況」與「個人及環境因素」之間複雜交互作用的結果。職業復康的關鍵，在於減少環境障礙，提升案主的活動與參與度。",
    matrix: [
      {
        category: "health_condition",
        title: "健康狀況 (Health Condition)",
        desc: "案主的疾病、受傷或診斷。",
        hk_examples: ["左腦缺血性中風 (Stroke)", "二型糖尿病 (Diabetes)", "創傷後壓力症 (PTSD)", "自閉症譜系障礙 (ASD)"]
      },
      {
        category: "body_functions",
        title: "身體功能與結構 (Body Functions & Structures)",
        desc: "生理系統功能或身體解剖部位的損傷。",
        hk_examples: ["右側偏癱、手部精細動作障礙", "耐力下降、容易疲勞", "社交溝通與非言語表達障礙", "慢性下背痛，無法久坐"]
      },
      {
        category: "activities",
        title: "活動 (Activities / Capacity)",
        desc: "個人執行任務或行動的能力（個體層面）。",
        hk_examples: ["無法獨立書寫或使用標準鍵盤", "無法長時間步行或搬運重物", "面對陌生人時無法流暢組織語言回答問題", "日常生活自理（穿衣、洗澡）速度較慢"]
      },
      {
        category: "participation",
        title: "參與 (Participation / Performance)",
        desc: "在實際生活/社會情境中的投入程度（社會層面）。",
        hk_examples: ["無法重投以往的小巴司機崗位", "未能參與常規的工作面試", "因焦慮或社交障礙而過度退縮，沒有社交生活", "因職場環境不配合而無法穩定就業"]
      },
      {
        category: "environmental_factors",
        title: "環境因素 (Environmental Factors)",
        desc: "案主所處的物理、社會和態度環境（阻礙或促進因素）。",
        hk_examples: ["【阻礙】公司辦公室沒有無障礙斜道與洗手間", "【阻礙】僱主對自閉症人士存有刻板印象，抗拒聘請", "【促進】復康會提供的無障礙復康巴士服務", "【促進】政府提供的殘疾人士在職培訓津貼及僱主改裝辦公室資助"]
      },
      {
        category: "personal_factors",
        title: "個人因素 (Personal Factors)",
        desc: "案主的背景特性，非健康狀況的一部份。",
        hk_examples: ["52歲，前小巴司機，中學學歷，只懂駕駛", "熱愛家庭，極之渴望重投工作賺錢養家（強烈內在動機）", "對電腦操作感到恐懼，缺乏信心", "22歲，剛大專畢業，對未來有一定抱負，但極度缺乏自信"]
      }
    ]
  }
};

export const MOCK_CASES = [
  {
    id: "case_01",
    name: "阿強 (Ah Keung)",
    category: "腦部損傷康復 (如中風、創傷性腦受損)",
    avatar: "👨‍✈️",
    age: 52,
    gender: "男",
    health_condition: "缺血性中風 (導致右側身體偏癱)",
    previous_job: "小巴司機 (開車30年)",
    family: "與妻子及兩名正在讀中學的子女同住，為家庭經濟支柱",
    welfare: "正領取高額傷殘津貼，家庭積蓄所剩無幾，正面臨極大經濟壓力",
    emotional_state: "焦慮、沮喪，伴有嚴重的「自我廢人化」認知融合。強烈抗拒轉文職或報讀再培訓課程，認為自己「慢」、「手腳唔協調去上堂會被其他人笑」。",
    icf_factors: [
      { text: "缺血性中風", type: "health_condition" },
      { text: "右側肢體偏癱，手部精細動作障礙", type: "body_functions" },
      { text: "無法長時間單手穩定控車，無法打字", type: "activities" },
      { text: "無法重投小巴司機工作，無法參與公開招募面試", type: "participation" },
      { text: "【阻礙】小巴行業完全無法容納單手操作者", type: "environmental_factors" },
      { text: "【促進】復康會職業復康中心提供無障礙學習環境與就業支援", type: "environmental_factors" },
      { text: "【促進】再培訓局 (ERB) 提供適合復康人士的文職培訓", type: "environmental_factors" },
      { text: "52歲，中一學歷，開車30年，無文職經驗", type: "personal_factors" },
      { text: "非常疼愛子女，極之希望履行父親責任賺錢養家", type: "personal_factors" },
      { text: "對使用電腦有恐懼感，認為電腦是「後生仔嘅野」", type: "personal_factors" }
    ],
    initial_dialogue: "「社工，你唔好同我講上咩再培訓、學電腦文職啦。我開左三十年車，依家邊邊身都郁唔到，字都打唔到一粒，去上堂咪即係出醜？我成個廢人咁，仲可以做咩？不如算啦……」",
    // 預設模擬對話流，用於離線演練
    roleplay_flow: [
      {
        user: "阿強，我好明白你開開下車突然面對中風，右手腳又唔聽使，心理上真係好難接受，亦好擔心去報名會被其他人笑。但我聽得出，你其實內心好想可以為屋企人承擔番，供仔女讀書，對嗎？",
        ai_reply: "「……係，我做老豆嘅，依家成個廢人咁要老婆做清潔養番我，我都好難過。但我真係好驚去學電腦，我都唔識字，去上堂實比人笑我慢。」",
        coach_hint: "【MI 提醒】：案主已經說出了「改變性談話 (Change Talk)」——他表達了對妻子的心疼以及為家庭承擔的願望。你可以使用「肯定 (Affirmation)」來增強他的力量，並使用 ACT 的「價值澄清」引導他：當老豆的價值，是不是只有開小巴才能實踐？"
      },
      {
        user: "你覺得好難過，正正反映出你係一個好疼錫家人、好有責任感嘅好爸爸。阿強，我想邀請你諗下，『照顧家庭、供仔女讀書』呢個做老豆嘅心願，係咪一定要開小巴先可以做到？如果我哋搵到另一份文職助理，雖然人工無以前咁多，但一樣可以履行到你呢個承諾，你覺得點？",
        ai_reply: "「……如果真係搵到份坐寫字樓、幫手吸下印、送下文件嘅工作，我當然想做。但問題係，人地會唔會請我咁樣嘅人？我打字又慢，又得一隻手打得靈活。」",
        coach_hint: "【ACT/MI 提醒】：案主動機大幅上升！他開始考慮文職助理的可能性，但出現了對「自身能力（打字慢、單手）」的障礙擔心。此時，在 ICF 框架下，這屬於「活動（打字能力）」與「環境（輸入法輔助/僱主態度）」的適應問題。你可以告訴他有專門的廣東話語音輸入法，或者只用單手就能做到的工作，來減低他的焦慮。"
      },
      {
        user: "打字慢完全有方法解決！依家電腦好先進，可以做語音輸入法，你講廣東話佢就會自動變做字，你一隻手打英文完全無問題。而且復康會同好多友好僱主合作過，佢哋知道你手腳慢，會將工作調整，等你可以勝任。我哋一步步黎，下星期先報讀一個針對復康人士嘅體驗班，唔好去諗太遠，只關注下星期上堂呢一步，好無？",
        ai_reply: "「……原來可以用講野黎打字？咁樣聽落好似容易少少。好啦社工，既然你咁講，我就試下報個名。但我真係好驚自己學唔識，去到會尷尬……」",
        coach_hint: "【輔導成功！】案主已經作出了微小的行動承諾（報名體驗班）！他依然有些許擔心（擔心學唔識），這很正常。你可以使用 ACT 的『接納』引導他：容許這份擔心存在，帶著擔心去上堂。這是一次極成功的輔導！"
      }
    ]
  },
  {
    id: "case_02",
    name: "阿樂 (Ah Lok)",
    category: "神經發展障礙 (如自閉症 ASD、過動症 ADHD)",
    avatar: "🧑‍💻",
    age: 22,
    gender: "男",
    health_condition: "自閉症譜系障礙 (ASD) 伴隨輕度社交焦慮",
    previous_job: "大專畢業後一直待業 (待業2年)",
    family: "與父母同住，父母過度保護，但最近母親因病入院，家庭經濟與照顧壓力陡增",
    welfare: "無領取津貼，依賴父親退休金維持生活",
    emotional_state: "極度逃避社交、面試。每次提到要去面試，身體就會出現強烈的焦慮反應（手震、心跳加速、無法說話），隨後出現嚴重的「逃避行為」（匿喺房打機）。自我評價極低，認為自己是「怪胎」，永遠無法適應職場環境。",
    icf_factors: [
      { text: "自閉症譜系障礙", type: "health_condition" },
      { text: "社交溝通與非言語表達障礙，面試焦慮", type: "body_functions" },
      { text: "在壓力環境下無法流暢回答問題", type: "activities" },
      { text: "待業2年，完全無法投入常規的就業市場與面試", type: "participation" },
      { text: "【阻礙】傳統面試高度依賴口頭社交技巧，對ASD人士極之不利", type: "environmental_factors" },
      { text: "【促進】政府及復康會推行「殘疾人士支持就業計劃」，有就業配對支援", type: "environmental_factors" },
      { text: "【促進】父母願意配合，雖然有點過度保護", type: "environmental_factors" },
      { text: "22歲，大專多媒體設計畢業，專業技能好", type: "personal_factors" },
      { text: "內心渴望獨立，想向父母證明自己有賺錢能力", type: "personal_factors" }
    ],
    initial_dialogue: "「社工……我……我真係去唔到面試。上次去到大堂，我個心跳得好快，好似呼吸唔到咁，我最後……我最後走左去。我覺得自己好沒用，我根本唔適合人類嘅社會……我想返房打機。」",
    roleplay_flow: [
      {
        user: "阿樂，你好勇敢，願意同我講番上次面試個種好辛苦、好想逃跑嘅感覺。個種心跳得好快、抖唔到氣嘅感覺真係好恐怖。但我留意到，你雖然咁驚，你今日依然黎到我哋中心搵我，這反映出你內心深處，其實好想行出呢一步、好想向父母證明自己係可以獨立嘅，對嗎？",
        ai_reply: "「……我想幫爸爸分擔，我見到媽媽病左，爸爸好辛苦。但我真係好怪，去到面試我連自己個名都講唔清，人地實覺得我好有問題。」",
        coach_hint: "【ACT 提示】：阿樂與負面標籤（『我很怪』、『我很沒用』）產生了嚴重的「認知融合」。請使用認知解離（Cognitive Defusion）技巧，引導他看清這只是大腦給他的諗法，而不是事實本身；並引導他接納面試時的心跳加速，將其視為正常的身體警報，不需要急著逃避。"
      }
    ]
  },
  {
    id: "case_03",
    name: "雅婷 (Ah Ting)",
    category: "慢性疾病 (如慢性疼痛、糖尿病或心臟病)",
    avatar: "👩&zwj;💼",
    age: 38,
    gender: "女",
    health_condition: "慢性下背痛及纖維肌痛症 (Chronic Low Back Pain & Fibromyalgia)",
    previous_job: "收銀與理貨員 (超市工作12年)",
    family: "單親媽媽，與10歲讀小學的兒子同住，獨自承擔所有照顧與經濟壓力",
    welfare: "正領取普通傷殘津貼及低收入在職家庭津貼，因停工面臨欠租與斷糧危機",
    emotional_state: "極度焦慮、無助，伴隨重度「經驗性逃避」及「痛楚認知融合」。她深信「一日唔斷尾就一日返唔到工」，將自己鎖在與痛楚對抗的死胡同中，抗拒任何轉職嘗試。",
    icf_factors: [
      { text: "慢性下背痛及纖維肌痛症", type: "health_condition" },
      { text: "全身游走性肌肉痛楚、長期疲勞與睡眠障礙，無法久站或彎腰搬重物", type: "body_functions" },
      { text: "日常家務需分段完成，無法長時間維持同一坐姿或操作電腦", type: "activities" },
      { text: "停工年半，無法重投以往體力勞動，拒絕參與任何就業配對", type: "participation" },
      { text: "【阻礙】大部分初級文職要求長期維持坐姿，且職場對痛楚調整彈性不足", type: "environmental_factors" },
      { text: "【促進】復康會職業健康中心提供人體工學評估及坐立兩用工作檯等合理便利資助", type: "environmental_factors" },
      { text: "【促進】再培訓局 (ERB) 提供網店營運與辦公室助理等彈性課程", type: "environmental_factors" },
      { text: "38歲，中五學歷，性格好強盡責，極度疼愛兒子", type: "personal_factors" },
      { text: "內在核心價值：成為一個能自立、能健康陪伴兒子成長的母親", type: "personal_factors" },
      { text: "對痛楚有極高敏感度與災難化想法，認為任何工作都會令病情惡化", type: "personal_factors" }
    ],
    initial_dialogue: "「社工，我真係好痛……全身肌肉好似火燒咁，醫生都話斷唔到尾。我連企多十五分鐘都頂唔順，點返工啊？你叫我轉做文職，但我坐得耐又係痛，我係咪成世都係咁？如果連租都交唔起，我同個仔點算……」",
    roleplay_flow: [
      {
        user: "雅婷，聽得出你依家承受緊好大嘅身體痛楚，而且要一個人湊住十歲嘅仔，經濟同交租嘅壓力真係好沉重，令你覺得好驚同無助。我哋先唔好急住諗返工，你願意同呢個全身好似火燒咁嘅痛楚、仲有心入面好驚嘅感覺，一齊深呼吸，先喺度坐一陣，比自己休息下先，好嗎？",
        ai_reply: "「……好，我試下吸氣……社工，我真係好累，我每日一擘大眼就係痛，我用盡方法同佢打交，睇中微、食止痛藥，但都係無用。我真係好憎呢個痛，點解佢偏偏要纏住我……」",
        coach_hint: "【ACT 提醒】：案主正處於與痛楚「摔跤」的經驗性逃避狀態。你可以引導她使用「認知解離」或「以己為景」：痛楚雖然在，但她不是痛楚本身，她是那個容納痛楚的舞台。或者引導她「接納」痛楚的暫時共存，釋放與痛楚戰鬥所消耗的巨大精力。"
      },
      {
        user: "每日同痛楚打交真係好消磨意志，難怪你覺得咁攰。雅婷，我哋試下做個『心靈擴展』練習，想像呢份痛好似一個唔受歡迎嘅客人，我哋試下唔好趕佢走，亦唔好同佢打交，嘗試用呼吸喺心入面畫一個大啲嘅空間比佢坐低。你不是這個痛楚，你是那個看著痛楚、依然好錫個仔、想陪佢成長嘅媽媽。你覺得可唔可以試下帶著痛，行一小步？",
        ai_reply: "「……帶著痛去行？我從來未試過咁諗。我以前總覺得，一定要完全唔痛，我先可以做番個正常人、去照顧我個仔。但我個仔……佢依家開始大，我真係好想好似以前咁帶佢去公園，或者賺到錢買份禮物比佢……」",
        coach_hint: "【MI/ACT 提醒】：太棒了！案主說出了改變性談話（Change Talk）——她表達了對兒子的愛與陪伴的渴望（核心價值觀）。此時可以使用 MI 的「肯定」去鞏固這個內在動機，並結合 ICF，討論如何透過「合理便利」（例如坐立兩用椅、彈性工時的網店營運）讓她在有痛楚的情況下依然能實踐陪伴與照顧兒子的價值。"
      },
      {
        user: "你真係一個好偉大嘅媽媽，即使身體咁痛，你最掛心嘅依然係點樣陪伴同照顧個仔。呢個就係你最珍貴嘅價值——『陪伴同支持個仔成長』。雅婷，既然完全消滅痛楚暫時好難，但我哋可唔可以一齊承諾，下星期我哋試下用半小時，報讀再培訓局網店營運嘅免費線上體驗課，上堂時如果痛，我哋就企起身伸展下，容許痛楚存在，但繼續為個仔行呢一步，你覺得點？",
        ai_reply: "「網店營運……可以喺屋企做？咁樣如果痛起上黎，我確實可以訓低或者企起身拉下筋。社工，雖然我仲係好驚會痛到頂唔順，但我真係想為個仔試一次。我想證明比佢睇，媽媽無放棄。」",
        coach_hint: "【輔導成功！】案主成功作出了微小的承諾行動（Committed Action），並且將痛楚與自我價值解離。這是一次極高水準的 ACT 價值引導與 MI 行動對接！"
      }
    ]
  },
  {
    id: "case_04",
    name: "偉杰 (Wai Kit)",
    category: "感官障礙 (如聽力損失、視力受損)",
    avatar: "🦻",
    age: 28,
    gender: "男",
    health_condition: "中度至嚴重感音神經性聽力損失 (雙耳佩戴助聽器)",
    previous_job: "主題樂園餐飲服務員 (工作5年)",
    family: "獨居，父母在深圳，在港社交圈子極小，缺乏情感與生活支援",
    welfare: "正領取普通殘疾津貼及交通車費資助，存款僅能維持數月生活",
    emotional_state: "社交退縮，伴隨嚴重的「自我殘廢化標籤」與「人際不信任」。他認為「戴機就係殘廢」、「去面試一被要求重複說話就覺得好樣衰」，在面試及公開溝通中極度逃避。",
    icf_factors: [
      { text: "中度至嚴重感音神經性聽力損失", type: "health_condition" },
      { text: "雙耳聽力受損，背景嘈雜環境下言語識別率極低，伴隨耳鳴", type: "body_functions" },
      { text: "在喧鬧環境溝通困難，聽電話不清楚，依賴視線 (讀唇) 輔助", type: "activities" },
      { text: "待業9個月，拒絕接聽招聘電話，不敢參與實體面試，社交中斷", type: "participation" },
      { text: "【阻礙】大部分僱主使用電話聯絡面試，工作環境噪音大且無溝通合理便利", type: "environmental_factors" },
      { text: "【促進】復康會提供聽覺復康及 FM 調頻傳送系統評估，轉介友好無障礙僱主", type: "environmental_factors" },
      { text: "【促進】政府提供「殘疾僱員輔助設備資助計劃」 (最高資助4萬港元)", type: "environmental_factors" },
      { text: "28歲，大專多媒體設計畢業，3D 繪圖及剪片技能極佳", type: "personal_factors" },
      { text: "內在核心價值：渴望發揮設計專業才華，被視作專業人士而非弱者", type: "personal_factors" },
      { text: "自尊心極強，對被要求重複說話有強烈挫敗與恥辱感", type: "personal_factors" }
    ],
    initial_dialogue: "「社工，我真係好怕去面試……次次去到，人地一見到我戴住助聽器，眼神就變左。面試官問野我又聽唔清，要人重複兩三次，我自己都覺得自己好樣衰。我讀多媒體設計，但係咪成世都只可以做工廠包裝？」",
    roleplay_flow: [
      {
        user: "偉杰，聽得出面試時要人重複問題，同埋見到人哋異樣眼神，帶比你非常之大嘅挫折同尷尬，亦令你對自己嘅多媒體設計才華感到明珠暗投。你其實好熱愛設計，好想人哋睇到你嘅專業，而唔係淨係見到你嘅聽障，對嗎？",
        ai_reply: "「……係，我用左好多心機讀設計，我手 3D 繪圖同剪片明明唔差過其他人。但依家好多工一打黎電話面試，我一聽唔清，對方就收我皮。我真係覺得好唔公平，點解因為對耳，就抹殺晒我所有嘅努力？」",
        coach_hint: "【ACT 提示】：案主展現出極強的「自尊與專業追求」（核心價值觀），但同時與「聽障等於殘廢/無用」的負面諗法深度融合，導致他逃避面試。請引導他使用「認知解離」，將「我耳聾就無用」的想法分開；並利用 ICF 框架，指出電話面試是「環境障礙」，我們可以用文字聯絡、助聽器輔助資助等「合理便利」來克服，重申他的設計價值。"
      },
      {
        user: "呢個世界確實對聽障人士有好多不理解，令你受委屈了。但偉杰，我想你留意住腦入面『因為我耳聾，所以多媒體設計就無用，只能做包裝』呢個諗法。我哋試下對自己講：『我留意到我有一個諗法，話我聽唔清就無用。』你覺得你嘅才華，真係會因為對耳而消失咩？定係，我哋其實可以主動同僱主提出，用電郵或 WhatsApp 同客溝通，發揮你最強嘅視覺設計優勢？",
        ai_reply: "「……我嘅才華唔會因為耳聾而消失……其實如果單純比作品集，我好有信心。但真係有公司願意用 WhatsApp 同我開會，或者面試時用打字同我溝通咩？我驚人地嫌麻煩。」",
        coach_hint: "【MI/ACT 提示】：案主開始放鬆防衛，表現出對「新型溝通管道（WhatsApp/文字面試）」的好奇與期待！這是一個極佳的改變性談話（Change Talk）。此時可以向他介紹香港復康會的「友好僱主配對計劃」，並利用政府的「殘疾僱員輔助設備資助計劃」作為促進因素，打消他的顧慮，引導他承諾行出第一步。"
      },
      {
        user: "絕對有！我哋中心合作過好多友好設計公司，佢哋本身就係用 Slack 或 WhatsApp 溝通，反而好歡迎用文字記錄，免得口頭開會講完又唔記得。而且政府有設備資助，可以幫公司裝溝通軟件或輔助字幕器。既然你對自己嘅作品咁有信心，我哋一齊做個承諾：下星期，你整理好作品集，我幫你聯絡一間友好設計公司，要求進行文字/電郵形式嘅第一輪面試，我哋試一次，容許面試前嘅心慌存在，但帶著作品去衝，好無？",
        ai_reply: "「如果可以用文字進行第一輪面試，我真係好想試！社工，我呢幾日會將我之前做落嘅 3D 作品整理好一個 Portfolio，到時麻煩你幫我引薦。我會試下接受我面試時緊張，多謝你話比我聽我嘅才華依然有用。」",
        coach_hint: "【輔導成功！】案主成功重塑了對自我價值的認同（認知解離），並基於他的多媒體設計核心價值，承諾了具體的求職準備行動（整理 Portfolio）。這是一次完美的職業復康輔導案例！"
      }
    ]
  }
];

export const MOCK_CO_LEARNING_CASES = [
  {
    id: "co_01",
    title: "阿強轉行抉擇：小組策略研討",
    description: "本案例展示了輔導中風康復者阿強時的對話轉折點，請小組成員一同探討如何運用 MI 及 ACT 理論引導案主。",
    dialogue_segment: "輔導員：「阿強，我知道轉行好難，但你想想，你如果不學電腦，以後怎樣養家呢？」\n阿強（生氣、抗拒）：「你講得輕巧！我幾十歲人中風，手腳唔聽使，你逼我學電腦？你係咪想睇我出醜？我唔會報名嘅，你走啦！」",
    questions: [
      {
        question: "小組討論：此時輔導員的說話犯了什麼MI的大忌？",
        options: [
          "沒有大忌，這樣可以直接刺激案主，讓他看清現實。",
          "輔導員陷入了「說教陷阱（Didactic Trap）」與「警報糾正反射」，直接指出了不改變的後果，這會引發案主強烈的防衛心與反駁，激發了「阻抗（Sustain Talk）」。",
          "輔導員沒有使用 ACT 的接納技術。"
        ],
        correct: 1,
        explanation: "在 MI 中，當同工直接說「如果不...會怎麼樣」時，很容易引發案主本能的自我辯護，案主會列舉十個不改變的理由（Sustain Talk），這在職業復康中是非常常見的阻抗來源。"
      },
      {
        question: "小組抉擇：面對阿強憤怒的阻抗，小組討論後，最建議的回應策略是什麼？",
        options: [
          "【MI 雙重反映與道歉】：先為剛才的逼迫道歉，然後反映他的無助與憤怒：「阿強，對唔住，我剛才太急於同你搵出路，忽略左你面對手腳不便時嘅無助同吃力感。你覺得我喺度逼你，令你又辛苦又氣憤，係嗎？」",
          "【堅持說教】：繼續勸說，向他展示成功中風者學會電腦的案例，用事實說服他。",
          "【ACT 認知解離】：叫他不要生氣，想想生氣對身體不好，引導他冷靜下來。"
        ],
        correct: 0,
        explanation: "當案主出現強烈阻抗時，首要任務是「滾動阻抗（Rolling with Resistance）」或道歉。通過真誠的雙重反映（反映他的生氣與不便），同理他的無助，能夠瞬間降溫衝突，重建信任，為後續的變革談話騰出空間。"
      }
    ]
  }
];

export const MOCK_MOTIVATIONAL_QUOTES = [
  "「我們不需要改變案主的感受，只需與他一起為感受創造接納的空間。」— ACT 理論",
  "「動機式訪談的核心是合作，而非對抗；是引導，而非灌輸。」— 威廉·米勒 (William R. Miller)",
  "「案主不是他的痛楚或疾病，他是容納這些生命體驗的天空。」— 心理彈性實踐",
  "「當你留意到腦海中有『我已經無用』的諗法，請試著與它解離，才華依然在你心中。」— 同工打氣語",
  "「改變談話（Change Talk）是案主內在力量的萌芽，我們的職責是傾聽與放大它。」— 職業復康心法"
];

export const MOCK_ACHIEVEMENTS = [
  {
    id: "first_session",
    name: "初試啼聲",
    icon: "fa-trophy",
    description: "成功完成第一次案主模擬對話並生成評估報告。",
    color: "var(--accent-purple)"
  },
  {
    id: "empathy_master",
    name: "同理心大師",
    icon: "fa-heart",
    description: "在諮商督導報告中，同理心 (MI OARS) 評定達到 90 分或以上。",
    color: "var(--accent-rose)"
  },
  {
    id: "case_creator",
    name: "生命合成家",
    icon: "fa-dna",
    description: "在 AI 基因合成艙中，成功合成一位符合香港背景的自定義個案。",
    color: "var(--accent-green)"
  },
  {
    id: "icf_expert",
    name: "全人評估官",
    icon: "fa-puzzle-piece",
    description: "完美將案主特徵拖拽歸類放入 ICF 五大評估維度，準確率達 100%。",
    color: "var(--accent-cyan)"
  },
  {
    id: "theory_explorer",
    name: "知識探險家",
    icon: "fa-book-open",
    description: "深入研讀 ACT、MI、ICF 理論子分頁並完美通過 OARS 闖關遊戲。",
    color: "var(--accent-amber)"
  },
  {
    id: "combat_specialist",
    name: "實戰特工",
    icon: "fa-user-shield",
    description: "在模擬輔導室中累積完成 3 次不同案主的全套輔導對話。",
    color: "#6366f1"
  }
];

export const TRANSLATIONS = {
  "zh-HK": {
    "dashboard": "儀表板 Dashboard",
    "theory": "理論學習 Hub",
    "arena": "個案實戰 Arena",
    "co-learning": "小組研討 Studio",
    "analytics": "學習分析 Analytics",
    "settings": "系統設定 Settings",
    "dashboard_welcome": "歡迎回來，復康輔導同工",
    "dashboard_subtitle": "今天想提升哪項專業技巧？選擇自學或進入模擬個案演練。",
    "dashboard_progress_title": "理論學習進度",
    "dashboard_progress_val": "已完成 4/6 章節",
    "dashboard_hours_title": "模擬對話時數",
    "dashboard_hours_val": "目標 10 小時",
    "dashboard_accuracy_title": "個案分析精準度",
    "dashboard_accuracy_val": "擊敗 90% 同工",
    "dashboard_cases_title": "已解鎖實戰個案",
    "dashboard_cases_online": "Gemini 智慧連線",
    "dashboard_cases_offline": "免密碼本地連線",
    "star_case_title": "本日星級推薦個案 (Star Case)",
    "star_case_desc": "系統根據你的表現，推薦今天挑戰：",
    "mystery_box_title": "隨機實戰「盲盒」 (Daily Mystery Box)",
    "mystery_box_desc": "時間有限？抽取一張隨機案主卡與當日情緒因子，直接啟動一場 5 分鐘高難度面談挑戰！",
    "mystery_box_click": "點擊抽取神秘案主卡",
    "mystery_box_sub": "抽卡即刻啟動對話模擬",
    "mini_radar_title": "個人能力值縮影 (Competence Radar)",
    "mini_radar_desc": "平台整合自學表現與 SOAP 評核的雷達圖：",
    "counseling_room_title": "模擬輔導室",
    "counseling_room_subtitle": "請扮演職業復康就業導師，使用 MI & ACT 技巧進行就業輔導與諮商。",
    "api_status_badge_online": "AI 在線模式",
    "api_status_badge_offline": "離線體驗模式 (免金鑰)",
    "theme_toggle_btn": "切換深淺色主題",
    "synthesis_title": "自定義個案合成基因艙",
    "synthesis_subtitle": "配置底層神經參數，利用 Google Gemini 智慧核心，在 8 秒內注入香港社會環境變量，合成一份全套 ICF 矩陣與地道廣東話抗拒心理台詞的實戰個案。",
    "synthesize_case_btn": "啟動生命特徵合成艙 (Begin Synthesis)",
    "system_settings_title": "平台全局設定",
    "system_settings_subtitle": "配置 Gemini API 金鑰、微調廣東話語音輸出，實現最佳體驗。"
  },
  "zh-CN": {
    "dashboard": "仪表板 Dashboard",
    "theory": "理论学习 Hub",
    "arena": "个案实战 Arena",
    "co-learning": "小组研讨 Studio",
    "analytics": "学习分析 Analytics",
    "settings": "系统设定 Settings",
    "dashboard_welcome": "欢迎回来，复康辅导同工",
    "dashboard_subtitle": "今天想提升哪项专业技巧？选择自学或进入模拟个案演练。",
    "dashboard_progress_title": "理论学习进度",
    "dashboard_progress_val": "已完成 4/6 章节",
    "dashboard_hours_title": "模拟对话时数",
    "dashboard_hours_val": "目标 10 小时",
    "dashboard_accuracy_title": "个案分析精准度",
    "dashboard_accuracy_val": "击败 90% 同工",
    "dashboard_cases_title": "已解锁实战个案",
    "dashboard_cases_online": "Gemini 智慧连线",
    "dashboard_cases_offline": "免密码本地连线",
    "star_case_title": "本日星级推荐个案 (Star Case)",
    "star_case_desc": "系统根据你的表现，推荐今天挑战：",
    "mystery_box_title": "随机实战「盲盒」 (Daily Mystery Box)",
    "mystery_box_desc": "时间有限？抽取一张随机案主卡与当日情绪因子，直接启动一场 5 分钟高难度面谈挑战！",
    "mystery_box_click": "点击抽取神秘案主卡",
    "mystery_box_sub": "抽卡即刻启动对话模拟",
    "mini_radar_title": "个人能力值缩影 (Competence Radar)",
    "mini_radar_desc": "平台整合自学表现与 SOAP 评核的雷达图：",
    "counseling_room_title": "模拟辅导室",
    "counseling_room_subtitle": "请扮演职业复康就业导师，使用 MI & ACT 技巧进行就业辅导与谘商。",
    "api_status_badge_online": "AI 在线模式",
    "api_status_badge_offline": "离线体验模式 (免金钥)",
    "theme_toggle_btn": "切换深浅色主题",
    "synthesis_title": "自定义个案合成基因舱",
    "synthesis_subtitle": "配置底层神经参数，利用 Google Gemini 智慧核心，在 8 秒内注入香港社会环境变量，合成一份全套 ICF 矩阵与地道广东话抗拒心理台词的实战个案。",
    "synthesize_case_btn": "启动生命特征合成舱 (Begin Synthesis)",
    "system_settings_title": "平台全局设定",
    "system_settings_subtitle": "配置 Gemini API 金钥、微调广东话语音输出，实现最佳体验。"
  },
  "en": {
    "dashboard": "Dashboard",
    "theory": "Theory Hub",
    "arena": "Case Arena",
    "co-learning": "Co-Learning Studio",
    "analytics": "Analytics",
    "settings": "Settings",
    "dashboard_welcome": "Welcome back, Vocational Rehab Counselor",
    "dashboard_subtitle": "What professional skills would you like to improve today? Select self-study or enter simulations.",
    "dashboard_progress_title": "Theory Progression",
    "dashboard_progress_val": "4/6 chapters completed",
    "dashboard_hours_title": "Dialogue Hours",
    "dashboard_hours_val": "Target 10 Hours",
    "dashboard_accuracy_title": "Case Analysis Accuracy",
    "dashboard_accuracy_val": "Beats 90% of peers",
    "dashboard_cases_title": "Unlocked Cases",
    "dashboard_cases_online": "Gemini Active Connection",
    "dashboard_cases_offline": "Local Offline Fallback",
    "star_case_title": "Daily Recommended Case (Star Case)",
    "star_case_desc": "Recommended challenge based on your current performance metrics:",
    "mystery_box_title": "Daily Mystery Challenge Box",
    "mystery_box_desc": "Limited time? Pull a random case and emotional factor to instantly begin a 5-minute roleplay session!",
    "mystery_box_click": "Click to Draw a Mystery Case",
    "mystery_box_sub": "Draw to instantly launch dialogue simulation",
    "mini_radar_title": "Competence Radar Overview",
    "mini_radar_desc": "Integrated radar chart from theory progression and SOAP assessments:",
    "counseling_room_title": "Roleplay Simulator",
    "counseling_room_subtitle": "Please play the role of vocational rehab counselor, using MI & ACT to conduct counseling.",
    "api_status_badge_online": "AI Online Mode",
    "api_status_badge_offline": "Offline Mode (No Key)",
    "theme_toggle_btn": "Toggle Dark/Light Mode",
    "synthesis_title": "AI Bio-Gen Case Synthesizer",
    "synthesis_subtitle": "Configure neural properties, inject HK social factors, and synthesize a complete ICF case with Cantonese resistant dialogues using Gemini in 8 seconds.",
    "synthesize_case_btn": "Launch Bio-Gen Synthesis Console",
    "system_settings_title": "Global System Settings",
    "system_settings_subtitle": "Configure Gemini API credentials and customize Cantonese TTS voice outputs."
  }
};



