import {parseDOM} from 'htmlparser2'
import * as CheerioSelect from './'

describe('index', () => {
    it('should find elements', () = {
        const dom = parseDOM('<div><p>First<p>Second');
        expect(CheerioSelect.select(dom, 'div')).hasLength(1)
    })
})