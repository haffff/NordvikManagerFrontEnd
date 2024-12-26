///NOT USED FOR NOW

'use strict'

import React from 'react'
import reactCSS from 'reactcss'
import { SketchPicker } from 'react-color'

class ColorPicker extends React.Component {

    toString(objectARGB) {
        return `rgba(${objectARGB.r},${objectARGB.g},${objectARGB.b},${objectARGB.a})`;
    }

    fromString(stringARGB) {
        if (typeof stringARGB !== typeof "") {
            return { r: 0, g: 0, b: 0, a: 0.5 }
        }

        //remove rgb/rgba first
        let noRgb = stringARGB.replace('rgba(', '').replace('rgb(', '').replace(')', '');
        //get values
        let result = noRgb.split(',').map(Number); // split and convert all parts to Number
        return { r: result[0], g: result[1], b: result[2], a: result[3] ?? 1 };
    }

    constructor(props)
    {
        super(props);
        this.state = {
            displayColorPicker: false,
            color: this.fromString(this.props.color),
            isAbsolute: this.props.isAbsolute
        };
    }
    
    handleClick = () => {
        this.setState({ ...this.state, displayColorPicker: !this.state.displayColorPicker })
        if(!this.state.displayColorPicker)
        {
            if(this.props.onOpen)
                this.props.onOpen();
        }
        else
        {
            if(this.props.onClose)
                this.props.onClose();
        }
    };

    handleClose = () => {
        this.setState({ ...this.state, displayColorPicker: false })
        if(this.props.onClose)
            this.props.onClose();
    };

    handleChange = (color) => {
        this.setState({ ...this.state, color: color.rgb });
        this.props.onChange(this.toString(color.rgb));
    };

    render() {
        const styles = reactCSS({
            'default': {
                color: {
                    width: '36px',
                    height: '14px',
                    borderRadius: '2px',
                    background: `rgba(${this.state.color.r}, ${this.state.color.g}, ${this.state.color.b}, ${this.state.color.a})`,
                },
                swatch: {
                    padding: '5px',
                    background: '#fff',
                    borderRadius: '1px',
                    boxShadow: '0 0 0 1px rgba(0,0,0,.1)',
                    display: 'inline-block',
                    cursor: 'pointer',
                },
                popover: {
                    position: this.state.isAbsolute ? 'absolute' : 'relative',
                },
                cover: {
                    position: this.state.isAbsolute ? 'absolute' : 'relative',
                    top: '0px',
                    right: '0px',
                    bottom: '0px',
                    left: '0px',
                },
            },
        });

        const compareColors = () => {
            let color1Str = this.fromString(this.props.color);
            let color2Str = this.state.color;

            return color1Str.r === color2Str.r && color1Str.g === color2Str.g && color1Str.b === color2Str.b && color1Str.a === color2Str.a;
        }

        if(this.props.color && this.state.color && !compareColors())
        {
            this.setState({ ...this.state, color: this.fromString(this.props.color) });
        }

        return (
            <div>
                <div style={styles.swatch} onClick={this.handleClick}>
                    <div style={styles.color} />
                </div>
                {this.state.displayColorPicker ? <div style={styles.popover}>
                    <div style={styles.cover} onClick={this.handleClose} />
                    <SketchPicker color={this.state.color} onChangeComplete={this.handleChange} />
                </div> : null}
            </div>
        )
    }
}

export default ColorPicker