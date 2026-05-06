import { render } from 'solid-js/web'
import '../index.css'
import { ModelPage } from '../components/ModelPage'
import wallHook from '../models/wall-hook'

render(() => <ModelPage model={wallHook} />, document.getElementById('root')!)
