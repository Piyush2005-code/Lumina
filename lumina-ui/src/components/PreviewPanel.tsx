import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { X, Copy } from 'lucide-react';
import type { PreviewFile } from '../types';
import styles from './PreviewPanel.module.css';

interface Props {
  files: PreviewFile[];
  activeFile: string | null;
  onSelectTab: (name: string) => void;
  onCloseTab: (name: string) => void;
}

export default function PreviewPanel({ files, activeFile, onSelectTab, onCloseTab }: Props) {
  const file = files.find(f => f.name === activeFile);

  const copyRaw = () => {
    if (file) navigator.clipboard.writeText(file.content);
  };

  return (
    <aside className={styles.panel}>
      <div className={styles.tabBar}>
        {files.map(f => (
          <div key={f.name} className={`${styles.tab} ${f.name === activeFile ? styles.activeTab : ''}`}>
            <button className={styles.tabLabel} onClick={() => onSelectTab(f.name)}>{f.name}</button>
            <button className={styles.tabClose} onClick={() => onCloseTab(f.name)}><X size={11} /></button>
          </div>
        ))}
      </div>

      <div className={styles.toolbar}>
        <button className={styles.toolbarBtn} onClick={copyRaw} title="Copy raw"><Copy size={12} /></button>
      </div>

      <div className={styles.content}>
        {!file ? (
          <div className={styles.empty}>
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            <p>No file open</p>
            <span>Click a file in the sidebar<br/>or ask Lumina to open one</span>
          </div>
        ) : (
          <div className={styles.md}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  const inline = !match;
                  return inline ? (
                    <code className={styles.inlineCode} {...props}>{children}</code>
                  ) : (
                    <div className={styles.codeBlock}>
                      {match && <span className={styles.langLabel}>{match[1]}</span>}
                      <SyntaxHighlighter
                        style={oneLight}
                        language={match?.[1] ?? 'text'}
                        PreTag="div"
                        customStyle={{ margin: 0, borderRadius: 8, fontSize: 12, background: '#f8f8fb' }}
                      >
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    </div>
                  );
                },
                blockquote({ children }) {
                  const str = String(children);
                  const alertMap: Record<string, string> = {
                    '[!NOTE]': styles.alertNote,
                    '[!WARNING]': styles.alertWarning,
                    '[!CAUTION]': styles.alertCaution,
                    '[!IMPORTANT]': styles.alertImportant,
                    '[!TIP]': styles.alertTip,
                  };
                  const key = Object.keys(alertMap).find(k => str.includes(k));
                  return <blockquote className={`${styles.blockquote} ${key ? alertMap[key] : ''}`}>{children}</blockquote>;
                },
                table({ children }) { return <div className={styles.tableWrap}><table className={styles.table}>{children}</table></div>; },
                th({ children }) { return <th className={styles.th}>{children}</th>; },
                td({ children }) { return <td className={styles.td}>{children}</td>; },
                h1({ children }) { return <h1 className={styles.h1}>{children}</h1>; },
                h2({ children }) { return <h2 className={styles.h2}>{children}</h2>; },
                h3({ children }) { return <h3 className={styles.h3}>{children}</h3>; },
                a({ href, children }) { return <a href={href} className={styles.link} target="_blank" rel="noreferrer">{children}</a>; },
              }}
            >
              {file.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </aside>
  );
}
