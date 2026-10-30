import {describe,expect,it,vi} from 'vitest';
import {createSpeechDictation,type SpeechRecognizer} from '@/lib/speech-dictation';
class FakeRecognition implements SpeechRecognizer {
 static latest:FakeRecognition;lang='';continuous=true;interimResults=true;maxAlternatives=0;
 onresult:SpeechRecognizer['onresult']=null;onerror:SpeechRecognizer['onerror']=null;onend:SpeechRecognizer['onend']=null;
 start=vi.fn();stop=vi.fn();abort=vi.fn();constructor(){FakeRecognition.latest=this;}
}
const callbacks=()=>({onText:vi.fn(),onListening:vi.fn(),onError:vi.fn()});
describe('browser dictation lifecycle with no real microphone',()=>{
 it('appends French final speech once, preserves the draft and never submits',()=>{
  const cb=callbacks(),session=createSpeechDictation(FakeRecognition,'Ma question :',cb);session.start();const r=FakeRecognition.latest;
  expect(r.lang).toBe('fr-FR');expect(r.interimResults).toBe(false);expect(r.start).toHaveBeenCalledOnce();
  const result={isFinal:true,0:{transcript:'combien reste-t-il ?'}};
  r.onresult?.({results:[result]});r.onresult?.({results:[result]});
  expect(cb.onText.mock.calls.map(c=>c[0])).toEqual(['Ma question : combien reste-t-il ?','Ma question : combien reste-t-il ?']);
  session.stop();expect(r.stop).toHaveBeenCalledOnce();r.onend?.();expect(cb.onListening).toHaveBeenLastCalledWith(false);
 });
 it('ignores callbacks captured before cancellation and detaches the microphone',()=>{
  const cb=callbacks(),session=createSpeechDictation(FakeRecognition,'',cb);session.start();const r=FakeRecognition.latest,late=r.onresult;session.abort();
  late?.({results:[{isFinal:true,0:{transcript:'late'}}]});expect(cb.onText).not.toHaveBeenCalled();expect(r.abort).toHaveBeenCalledOnce();expect(r.onresult).toBeNull();
 });
 it('handles permission denial without losing the draft and bounds the transcript',()=>{
  const cb=callbacks();createSpeechDictation(FakeRecognition,'x'.repeat(1990),cb).start();const r=FakeRecognition.latest;
  r.onresult?.({results:[{isFinal:true,0:{transcript:'une phrase très longue'}}]});expect(cb.onText.mock.calls[0][0]).toHaveLength(2000);cb.onText.mockClear();
  r.onerror?.({error:'not-allowed'});expect(cb.onError).toHaveBeenCalledWith(expect.stringContaining('Micro non autorisé'));expect(cb.onText).not.toHaveBeenCalled();
  r.onresult?.({results:[{isFinal:true,0:{transcript:'late'}}]});expect(cb.onText).not.toHaveBeenCalled();expect(r.abort).toHaveBeenCalledOnce();
 });
});
