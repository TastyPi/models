import { render } from 'solid-js/web'
import '../index.css'
import { ModelPage } from '../components/ModelPage'
import { groups } from '../models/registry'

const group = groups.find(g => g.slug === 'gridfinity-baseplate')!

render(() => <ModelPage model={group.entries[0].model} group={group} />, document.getElementById('root')!)
