import React, { Component, PropTypes } from 'react';
import ReactDOM from 'react-dom';
import TextAreaAutosize from 'react-textarea-autosize';
import _ from 'lodash';

var links = [];
var highlightableItems = {
  atref: {
    name: 'atref',
    itemList: [],
    keyChar: '@'
  },
  hashtag: {
    name: 'hashtag',
    itemList: [],
    keyChar: '#'
  },
  members: {
    name: 'members',
    itemList: [],
    keyChar: ' '
  }
};

function getCaretPosition (element) {
  var CaretPos = 0;   // IE Support
  if (document.selection) {
    element.focus();
    var Sel = document.selection.createRange();
    Sel.moveStart('character', -element.value.length);
    CaretPos = Sel.text.length;
  }
  // Firefox support
  else if(element.selectionStart || element.selectionStart === '0') {
    CaretPos = element.selectionStart;
  }

  return (CaretPos);
}

function setCaretPosition(element, pos){
  if(element.setSelectionRange)
  {
    element.focus();
    element.setSelectionRange(pos, pos);
  }
  else if (element.createTextRange) {
    var range = element.createTextRange();
    range.collapse(true);
    range.moveEnd('character', pos);
    range.moveStart('character', pos);
    range.select();
  }
}

function dedupHashtags(hashtags) {
  return _.uniq(hashtags);
}

function dedupLinks(linksToDedupe) {
  var parser = document.createElement('a');
  return _.uniq(linksToDedupe, function(link) {
    parser.href = link;
    return parser.hostname.replace(/^www\./, '') + parser.pathname + parser.search + parser.hash;
  });
}

function dedupAtrefs(atrefs) {
  return _.uniq(atrefs, function(atref) {
    return atref.id;
  });
}

class SmartTextArea extends Component {
  constructor(props) {
    super(props);
    this.state = {
                    showAtRef: false,
                    showHashtagPicker: false,
                    contentText: this.props.defaultValue,
                    // contentText: '',
                    showMembersSuggestions: false
                };

  }

  /*
   * To be used by the caller to get the final content from the textarea
   */
  getContent() {
    return {
      text: this.state.contentText,
      mentions: dedupAtrefs(this.getAtrefsInContentText()),
      links: dedupLinks(links),
      tags: dedupHashtags(this.getHashtagsInContentText()),
      emoticons: [],
      // validEmails: this.getValidEmails()
    };
  }

  _getCaretPosition() {
    return getCaretPosition(ReactDOM.findDOMNode(this.refs.newPostTextArea));
  }

  isCursorInCharZone(char) {
    var caretPosition = this._getCaretPosition();
    var anchorChars = ['#', '@'];
    var spaceCount = 0;
    var i = caretPosition - 1;
    var charAtPos = this.state.contentText[i];

    if(!caretPosition || caretPosition <= 0) {
      return false;
    }
     
// TODO - very inefficient
// if the string is 10000 characters wrong, a backspace might trigger a search through all the 10000 characters
// that is the reason i was short circuiting the search when a space was found
// one hack is to not go beyond three spaces
    while(i >= 0 && spaceCount < 2) {
      // if there is no atref or hashtag and the post/comment/text is very long, the cursor at the end of the text,
      // searching the whole text backwards is not at all a good idea.
      if(this.state.contentText[i] === ' ') {
        spaceCount += 1;
      }
      // let's short circuit in any special anchor char
      if(anchorChars.indexOf(this.state.contentText[i]) >= 0) {
        if(charAtPos === char) {
          // if it's the beginning of string
          // or the preceding character to '@' or '#' is space or '\n'
          if(i === 0 || this.state.contentText.charCodeAt(i - 1) === 32 || this.state.contentText.charCodeAt(i - 1) === 10) {
            return true;
          } else {
            return false;
          }
        } else {
          return false;
        }
      }
      i--;
      charAtPos = this.state.contentText[i];
    }

    return false;
  }

  isCursorInAtrefZone() {
    return this.isCursorInCharZone('@');
  }

  handleTextareaClick(event) {
    var showAtRef = this.isCursorInAtrefZone();
    // var showHashtagPicker = this.isCursorInHashtagZone();
    this.setState({
        showAtRef: showAtRef,
        showHashtagPicker: false
    });
  }

  handleInputChange(event) {
    this.setState({
      contentText: event.target.value
    }, () => {
      typeof this.props.onChange === 'function' && this.props.onChange(this.getContent());
      // this.recalculateSize();
    });
  }

  render() {
          // onClick={this.handleTextareaClick}
          // ref='newPostTextArea'
          // onFocus={this.handleFocus}
          // onBlur={this.handleBlur}
          // onKeyDown={this.props.type === 'members' ? this.handleKeyDownMembers : this.handleKeyDown}
          // onKeyUp={this.props.type === 'members' ? this.handleKeyUpMembers : this.handleKeyUp}
          // onKeyPress={this.handleKeyPress}
          // placeholder={this.props.placeholder}
    return (
      <TextAreaAutosize
          defaultValue={this.props.defaultValue}
          onClick={this.handleTextareaClick.bind(this)}
          onChange={this.handleInputChange.bind(this)}
          className='pp-newpost__textarea'
          value={this.state.contentText}
          ref='newPostTextArea'
          >
      </TextAreaAutosize>
    );
  }
};

SmartTextArea.propTypes = {
  defaultValue: PropTypes.string,
  placeholder: PropTypes.string
};

SmartTextArea.defaultProps = {
  placeholder: 'Hey there! Share your moment! Now?',
  defaultValue: '',
  type: 'default'
};

export default SmartTextArea;