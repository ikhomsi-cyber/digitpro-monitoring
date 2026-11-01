import {it,expect} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {AssistantAnswer} from '@/components/dashboard/AssistantAnswer';
it('renders model formatting as safe React text without executing HTML or links',()=>{
 const html=renderToStaticMarkup(createElement(AssistantAnswer,{text:'### Résumé\n- **CA** : 120 €\n<script>alert("private")</script>\n[ouvrir](javascript:alert(1))'}));
 expect(html).toContain('<h3');expect(html).toContain('<strong');expect(html).toContain('&lt;script&gt;');expect(html).not.toContain('<script>');expect(html).not.toContain('href=');
});
