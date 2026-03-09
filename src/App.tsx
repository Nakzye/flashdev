import { useState, useEffect, useCallback } from "react";
import "./App.css";

interface Flashcard {
  id: string;
  front: string;
  back: string;
  category: string;
  difficulty: 1 | 2 | 3; // 1=easy, 2=medium, 3=hard
  nextReview: number; // timestamp
  interval: number; // days
  repetitions: number;
  easeFactor: number; // SM-2
}

const BUILT_IN_DECKS: { category: string; icon: string; cards: Omit<Flashcard, "id" | "nextReview" | "interval" | "repetitions" | "easeFactor">[] }[] = [
  {
    category: "JavaScript",
    icon: "⚡",
    cards: [
      { front: "O que é closure em JavaScript?", back: "Uma closure é uma função que tem acesso ao escopo externo mesmo após o escopo ter fechado. A função 'fecha sobre' as variáveis do escopo pai.", category: "JavaScript", difficulty: 2 },
      { front: "Qual a diferença entre == e === ?", back: "== compara valores com coerção de tipo (1 == '1' → true). === compara valor E tipo sem coerção (1 === '1' → false).", category: "JavaScript", difficulty: 1 },
      { front: "O que é o Event Loop?", back: "O Event Loop é o mecanismo que permite ao JavaScript executar operações assíncronas. Ele monitora a Call Stack e a Callback Queue, movendo callbacks quando a stack estiver vazia.", category: "JavaScript", difficulty: 3 },
      { front: "O que é Promise?", back: "Promise é um objeto que representa o resultado eventual de uma operação assíncrona. Pode estar em 3 estados: pending, fulfilled ou rejected.", category: "JavaScript", difficulty: 2 },
      { front: "Diferença entre let, const e var?", back: "var: escopo de função, hoisting. let: escopo de bloco, não tem hoisting. const: escopo de bloco, não pode ser reatribuída (mas o objeto pode ser mutado).", category: "JavaScript", difficulty: 1 },
      { front: "O que é hoisting?", back: "Hoisting é o comportamento do JavaScript de mover declarações de variáveis (var) e funções para o topo do escopo durante a compilação. O valor não é hoisted, apenas a declaração.", category: "JavaScript", difficulty: 2 },
    ],
  },
  {
    category: "React",
    icon: "⚛️",
    cards: [
      { front: "O que é JSX?", back: "JSX é uma extensão de sintaxe do JavaScript que parece HTML. É transpilado para React.createElement() pelo Babel. Permite escrever UI de forma declarativa.", category: "React", difficulty: 1 },
      { front: "Qual a diferença entre state e props?", back: "Props são dados imutáveis passados de pai para filho. State é dado interno e mutável de um componente. Quando state muda, o componente re-renderiza.", category: "React", difficulty: 1 },
      { front: "O que é useEffect?", back: "useEffect é um hook para efeitos colaterais (fetch de dados, subscriptions, DOM mutations). Executa após cada render. O array de dependências controla quando ele re-executa.", category: "React", difficulty: 2 },
      { front: "O que é o Virtual DOM?", back: "Virtual DOM é uma representação em memória do DOM real. O React compara o VDOM anterior com o novo (diffing) e aplica só as mudanças necessárias ao DOM real (reconciliation).", category: "React", difficulty: 2 },
      { front: "O que é useState?", back: "useState é um hook que adiciona estado a componentes funcionais. Retorna um array com [valor, função_setter]. Quando o setter é chamado, o componente re-renderiza.", category: "React", difficulty: 1 },
    ],
  },
  {
    category: "CSS",
    icon: "🎨",
    cards: [
      { front: "O que é o modelo Box Model?", back: "Box Model é como o CSS calcula o tamanho dos elementos: content + padding + border + margin. Com box-sizing: border-box, padding e border ficam dentro do width.", category: "CSS", difficulty: 1 },
      { front: "Diferença entre Flexbox e Grid?", back: "Flexbox é unidimensional (linha OU coluna). Grid é bidimensional (linha E coluna). Flexbox é melhor para componentes, Grid para layouts de página.", category: "CSS", difficulty: 2 },
      { front: "O que é specificity?", back: "Specificity determina qual regra CSS vence em conflito. Ordem: !important > inline > ID(100) > classe/pseudo(10) > elemento(1). Valores mais altos vencem.", category: "CSS", difficulty: 2 },
      { front: "O que é position: relative vs absolute?", back: "relative: posiciona relativo à sua posição normal, mantém espaço no fluxo. absolute: posiciona relativo ao ancestor positioned mais próximo, sai do fluxo.", category: "CSS", difficulty: 2 },
    ],
  },
  {
    category: "Git",
    icon: "🐙",
    cards: [
      { front: "Diferença entre git merge e git rebase?", back: "merge: une branches criando um commit de merge, preserva histórico. rebase: reaplica commits sobre outra branch, cria histórico linear mas reescreve commits.", category: "Git", difficulty: 2 },
      { front: "O que faz git stash?", back: "git stash salva temporariamente mudanças não commitadas (staged e unstaged) e limpa o working directory. Use git stash pop para restaurar.", category: "Git", difficulty: 1 },
      { front: "O que é git cherry-pick?", back: "git cherry-pick <commit-hash> aplica um commit específico de outra branch na branch atual. Útil para trazer correções pontuais sem fazer merge.", category: "Git", difficulty: 3 },
    ],
  },
];

type Screen = "decks" | "study" | "result" | "add" | "custom";

function initCards(): Flashcard[] {
  const saved = localStorage.getItem("flashdev-cards");
  if (saved) return JSON.parse(saved);
  return BUILT_IN_DECKS.flatMap((deck) =>
    deck.cards.map((c) => ({
      ...c,
      id: crypto.randomUUID(),
      nextReview: Date.now(),
      interval: 1,
      repetitions: 0,
      easeFactor: 2.5,
    }))
  );
}

// SM-2 algorithm
function sm2(card: Flashcard, grade: 0 | 1 | 2 | 3 | 4 | 5): Flashcard {
  let { easeFactor, interval, repetitions } = card;
  easeFactor = Math.max(1.3, easeFactor + 0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));
  if (grade < 3) {
    repetitions = 0;
    interval = 1;
  } else {
    if (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 6;
    else interval = Math.round(interval * easeFactor);
    repetitions++;
  }
  const nextReview = Date.now() + interval * 86400000;
  return { ...card, easeFactor, interval, repetitions, nextReview };
}

export default function App() {
  const [cards, setCards] = useState<Flashcard[]>(initCards);
  const [screen, setScreen] = useState<Screen>("decks");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [queue, setQueue] = useState<Flashcard[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [sessionStats, setSessionStats] = useState({ correct: 0, hard: 0, skip: 0 });

  // New card form
  const [newFront, setNewFront] = useState("");
  const [newBack, setNewBack] = useState("");
  const [newCategory, setNewCategory] = useState("JavaScript");
  const [newDeckName, setNewDeckName] = useState("");

  useEffect(() => {
    localStorage.setItem("flashdev-cards", JSON.stringify(cards));
  }, [cards]);

  const categories = [...new Set(cards.map((c) => c.category))];

  const getDue = (category: string | null) =>
    cards.filter((c) => (!category || c.category === category) && c.nextReview <= Date.now());

  const startStudy = (category: string | null) => {
    const due = getDue(category);
    if (due.length === 0) return;
    const shuffled = [...due].sort(() => Math.random() - 0.5);
    setQueue(shuffled);
    setQueueIndex(0);
    setFlipped(false);
    setSelectedCategory(category);
    setSessionStats({ correct: 0, hard: 0, skip: 0 });
    setScreen("study");
  };

  const handleGrade = useCallback((grade: 0 | 1 | 2 | 3 | 4 | 5) => {
    const current = queue[queueIndex];
    const updated = sm2(current, grade);
    setCards((prev) => prev.map((c) => (c.id === current.id ? updated : c)));
    if (grade >= 3) setSessionStats((s) => ({ ...s, correct: s.correct + 1 }));
    else if (grade === 1) setSessionStats((s) => ({ ...s, hard: s.hard + 1 }));
    else setSessionStats((s) => ({ ...s, skip: s.skip + 1 }));

    if (queueIndex + 1 >= queue.length) {
      setScreen("result");
    } else {
      setQueueIndex((i) => i + 1);
      setFlipped(false);
    }
  }, [queue, queueIndex]);

  const addCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFront.trim() || !newBack.trim()) return;
    const card: Flashcard = {
      id: crypto.randomUUID(),
      front: newFront.trim(),
      back: newBack.trim(),
      category: newCategory,
      difficulty: 2,
      nextReview: Date.now(),
      interval: 1,
      repetitions: 0,
      easeFactor: 2.5,
    };
    setCards((prev) => [...prev, card]);
    setNewFront("");
    setNewBack("");
  };

  const addDeck = () => {
    if (!newDeckName.trim()) return;
    setNewCategory(newDeckName.trim());
    setNewDeckName("");
  };

  const currentCard = queue[queueIndex];

  // ─── STUDY SCREEN ─────────────────────────────────────────────────────────
  if (screen === "study" && currentCard) {
    return (
      <div className="app">
        <div className="study-container">
          <div className="study-header">
            <button className="back-btn" onClick={() => setScreen("decks")}>← Voltar</button>
            <span className="study-progress">{queueIndex + 1} / {queue.length}</span>
            <span className="study-cat">{currentCard.category}</span>
          </div>

          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${((queueIndex) / queue.length) * 100}%` }} />
          </div>

          <div className={`card-wrapper${flipped ? " flipped" : ""}`} onClick={() => !flipped && setFlipped(true)}>
            <div className="flashcard">
              <div className="card-face card-front">
                <div className="card-label">PERGUNTA</div>
                <p className="card-text">{currentCard.front}</p>
                {!flipped && <p className="card-hint">Clique para revelar →</p>}
              </div>
              <div className="card-face card-back">
                <div className="card-label">RESPOSTA</div>
                <p className="card-text">{currentCard.back}</p>
              </div>
            </div>
          </div>

          {flipped ? (
            <div className="grade-buttons">
              <p className="grade-label">Como foi?</p>
              <div className="grade-row">
                <button className="grade-btn hard" onClick={() => handleGrade(0)}>
                  <span>😓</span>
                  <span>Não lembrei</span>
                </button>
                <button className="grade-btn medium" onClick={() => handleGrade(3)}>
                  <span>🤔</span>
                  <span>Com esforço</span>
                </button>
                <button className="grade-btn easy" onClick={() => handleGrade(5)}>
                  <span>😊</span>
                  <span>Fácil!</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flip-hint">
              <button className="flip-btn" onClick={() => setFlipped(true)}>Revelar Resposta</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── RESULT SCREEN ────────────────────────────────────────────────────────
  if (screen === "result") {
    const total = sessionStats.correct + sessionStats.hard + sessionStats.skip;
    const pct = total > 0 ? Math.round((sessionStats.correct / total) * 100) : 0;
    return (
      <div className="app">
        <div className="result-container">
          <div className="result-emoji">{pct >= 80 ? "🏆" : pct >= 50 ? "💪" : "📚"}</div>
          <h2 className="result-title">Sessão Concluída!</h2>
          <div className="result-stats">
            <div className="result-stat easy">
              <span className="rvalue">{sessionStats.correct}</span>
              <span className="rlabel">Acertei</span>
            </div>
            <div className="result-stat medium">
              <span className="rvalue">{sessionStats.hard}</span>
              <span className="rlabel">Difícil</span>
            </div>
            <div className="result-stat hard">
              <span className="rvalue">{sessionStats.skip}</span>
              <span className="rlabel">Erro</span>
            </div>
          </div>
          <div className="result-score">{pct}% de acerto</div>
          <div className="result-actions">
            <button className="btn-primary" onClick={() => startStudy(selectedCategory)}>
              Estudar Novamente
            </button>
            <button className="btn-secondary" onClick={() => setScreen("decks")}>
              Ver Baralhos
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── ADD CARDS SCREEN ─────────────────────────────────────────────────────
  if (screen === "add") {
    return (
      <div className="app">
        <div className="add-container">
          <div className="add-header">
            <button className="back-btn" onClick={() => setScreen("decks")}>← Voltar</button>
            <h2 className="add-title">Adicionar Cartão</h2>
          </div>
          <form className="add-form" onSubmit={addCard}>
            <div className="field">
              <label>Categoria</label>
              <div className="cat-row">
                <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="field-input">
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <div className="new-deck-row">
                  <input
                    placeholder="Nova categoria..."
                    value={newDeckName}
                    onChange={(e) => setNewDeckName(e.target.value)}
                    className="field-input"
                  />
                  <button type="button" className="btn-add-deck" onClick={addDeck}>+</button>
                </div>
              </div>
            </div>
            <div className="field">
              <label>Pergunta (frente)</label>
              <textarea
                className="field-input"
                rows={3}
                placeholder="O que é...?"
                value={newFront}
                onChange={(e) => setNewFront(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Resposta (verso)</label>
              <textarea
                className="field-input"
                rows={4}
                placeholder="A resposta completa..."
                value={newBack}
                onChange={(e) => setNewBack(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn-primary" disabled={!newFront.trim() || !newBack.trim()}>
              Adicionar Cartão
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ─── DECKS SCREEN (HOME) ──────────────────────────────────────────────────
  const totalDue = getDue(null).length;

  return (
    <div className="app">
      <div className="decks-container">
        <header className="decks-header">
          <div className="logo">
            <span>🧠</span>
            <div>
              <h1>Flash<span className="accent">Dev</span></h1>
              <p>Memorização ativa para devs</p>
            </div>
          </div>
          <button className="btn-add" onClick={() => setScreen("add")}>+ Cartão</button>
        </header>

        {totalDue > 0 && (
          <div className="due-banner" onClick={() => startStudy(null)}>
            <span>🔔 {totalDue} cartão{totalDue > 1 ? "s" : ""} para revisar hoje</span>
            <span className="due-cta">Estudar agora →</span>
          </div>
        )}

        <div className="decks-grid">
          {BUILT_IN_DECKS.concat(
            categories.filter((c) => !BUILT_IN_DECKS.find((d) => d.category === c)).map((c) => ({
              category: c, icon: "📦",
              cards: cards.filter((card) => card.category === c).map((card) => ({
                front: card.front, back: card.back, category: card.category, difficulty: card.difficulty as 1|2|3,
              })),
            }))
          ).map((deck) => {
            const total = cards.filter((c) => c.category === deck.category).length;
            const due = getDue(deck.category).length;
            const mastered = cards.filter((c) => c.category === deck.category && c.repetitions >= 3).length;
            return (
              <div key={deck.category} className="deck-card">
                <div className="deck-top">
                  <span className="deck-icon">{deck.icon}</span>
                  <div>
                    <h3 className="deck-name">{deck.category}</h3>
                    <p className="deck-count">{total} cartões • {mastered} dominados</p>
                  </div>
                </div>
                <div className="deck-bar">
                  <div className="deck-bar-fill" style={{ width: `${total > 0 ? (mastered / total) * 100 : 0}%` }} />
                </div>
                <div className="deck-footer">
                  <span className={`due-badge${due > 0 ? " has-due" : ""}`}>
                    {due > 0 ? `${due} para revisar` : "Em dia ✓"}
                  </span>
                  <button
                    className="study-btn"
                    onClick={() => startStudy(deck.category)}
                    disabled={due === 0}
                  >
                    {due > 0 ? "Estudar" : "Concluído"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
