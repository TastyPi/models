import { render } from 'solid-js/web'
import '../index.css'
import { ModelPage } from '../components/ModelPage'
import cornerRadiusGauge from '../models/corner-radius-gauge'

render(() => <ModelPage model={cornerRadiusGauge} />, document.getElementById('root')!)
