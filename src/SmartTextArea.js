import React, { Component, PropTypes } from 'react';
import ReactDOM from 'react-dom';
import TextAreaAutosize from 'react-textarea-autosize';
import Autolinker from 'autolinker';
import _ from 'lodash';
import classnames from 'classnames';
require('style!css!./style.css');
require('style!css!./reset.css');

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
  }
};

function getCaretPosition(element) {
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

  hashtagToHtml(text) {
    var hashTagRegex = /(^|\s)(#[a-z\d-]+)/ig;
    return text.replace(hashTagRegex, '$1<span class="highlighter">$2</span>');
  }

  atrefToHtml(text) {
    return _.reduce(highlightableItems.atref.itemList, function(acc, item) {
      var regex = new RegExp(highlightableItems.atref.keyChar+item.name, "g");
      return acc.replace(regex, `<span class="highlighter">${highlightableItems.atref.keyChar}${item.name}</span>`);

      return acc;
    }, text);
  }

  newlineToHtml(text) {
    var newlineRegex = new RegExp('\n', 'g');
    return text.replace(newlineRegex, '<br/>');
  }

  // IMP - side effect causing function
  dangerouslyAutoLink(text) {
      links = []; // reset links
      return Autolinker.link(text, {replaceFn: function(autolinker, match) {
                          // var supportedDomains = ['.com', '.org', '.net', '.int', '.edu']
                          // link only the urls. we don't need emails, mentions etc to be linked
                          if(match.getType() === 'url' && (match.matchedText.indexOf('http://') >= 0 || match.matchedText.indexOf('https://') >= 0)){
                              var tag = autolinker.getTagBuilder().build(match);  // returns an Autolinker.HtmlTag instance
                              links.push(match.url);
                              // set the innerHtml to whatever text was entered. else it goes out of sync with the text in textarea.
                              tag.innerHtml = match.matchedText;

                              return tag;
                            } else {
                              return match.matchedText;
                            }
                          }});
    }

  getHtmlStringForGhostDiv(text) {
    return _.flow(this.atrefToHtml, this.newlineToHtml, this.dangerouslyAutoLink)(text);
  }

  getGhostDivContent() {
    if(!this.refs.newPostTextArea) {
      return '';
    }

    var textarea = ReactDOM.findDOMNode(this.refs.newPostTextArea);

    var ghostDivStyle = {
      padding: window.getComputedStyle(textarea, null).getPropertyValue('padding-left'),
      width: textarea.offsetWidth,
      height: textarea.offsetHeight
    };

    var contentText = this.getHtmlStringForGhostDiv(_.escape(this.state.contentText));

    return (<div ref='ghostDiv' className='ghostdiv' style={ghostDivStyle} dangerouslySetInnerHTML={{__html: contentText}}></div>);
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

  handleFocus() {
    typeof this.props.onTextareaFocus === 'function' && this.props.onTextareaFocus();
  }

  handleBlur() {
    typeof this.props.onTextareaBlur === 'function' && this.props.onTextareaBlur();
  }

  handleTextareaClick(event) {
    var showAtRef = this.isCursorInAtrefZone();
    this.setState({
        showAtRef: showAtRef
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

  handleKeyPress(event) {
    var showAtRef = this.state.showAtRef;

    switch(event.which) {
      case 64: // '@'
        if(event.target.value[this._getCaretPosition() - 1] === ' '
          || event.target.value[this._getCaretPosition() - 1] === undefined
          || event.target.value[this._getCaretPosition() - 1] === '\n') {
          showAtRef = true;
        }
        break;
      default: // do nothing
    }

    this.setState({
      showAtRef: showAtRef
    });
  }

  handleKeyDown(event) {
    switch(event.keyCode) {
      // case 13://Enter
      //   if(this.state.showAtRef) {
      //     event.preventDefault();
      //     this.handleAtRefEnterKeyPress();
      //     this.setState({ showAtRef: false });
      //   }
      //   break;
      // case 38: // up
      //   if(this.state.showAtRef) {
      //     event.preventDefault();
      //     this.refs.comboboxNodeForAtref.stepUp();
      //     return;
      //   }
      //   break;
      // case 40: // down
      //   if(this.state.showAtRef) {
      //     event.preventDefault();
      //     event.stopPropagation();
      //     this.refs.comboboxNodeForAtref.stepDown();
      //     return;
      //   }
      //   break;
      default:
      // don't do nothing
    }
  }

  handleKeyUp(event) {
    var showAtRef = this.state.showAtRef;

    switch(event.keyCode) {
      case 27: // escape key
        showAtRef = false;
        break;
      case 8: // backspace
        showAtRef = this.isCursorInAtrefZone();
        break;
        default:
        return;
    }
    this.setState({
      showAtRef: showAtRef
    });
  }

  getContentWithItem(item, itemType) {
      var postText = this.state.contentText;
      var lastCharacterEnteredIndex = this._getCaretPosition();
      var indexOfChar = this._getIndexOfNearestChar(this.state.contentText, highlightableItems[itemType].keyChar);

      return postText.substr(0, indexOfChar+1) + (item.name ? `${item.name} ` : '') + postText.substr(lastCharacterEnteredIndex, postText.length);
  }

  handleHighlightableItemEnterKeyPress(item, itemType) {
      // in case enter was pressed when the filtered list had no items
      if(!item) {
          return;
      }

      var postText = this.state.contentText,
          keyChar = highlightableItems[itemType].keyChar,
          nearestKeyCharPosition = this._getIndexOfNearestChar(postText, keyChar),
          itemList = highlightableItems[itemType].itemList;
      var self = this;

      itemList.push(item);

      this.setState({
          contentText: this.getContentWithItem(item, itemType),
          showAtRef: false
      }, function() {
          setCaretPosition(self.refs.newPostTextArea.getDOMNode(), nearestKeyCharPosition + item.name.length + 2);
      });
  }

  handleAtrefChange(newValue) {
    this.handleHighlightableItemEnterKeyPress(newValue, 'atref')

    console.log('new value: ', newValue);
  }



  getAtrefComponent() {
    if(typeof this.props.getListComponent !== 'function') {
      return null;
    }

    var ListComponent = this.props.getListComponent();
    var options = [
      { value: 'Radha', label: 'Radha' },
      { value: 'Kishan', label: 'Kishan' }
    ];

    return (
      <ListComponent
        value='Radha'
        options={options}
        onChange={this.handleAtrefChange.bind(this)}
        />
    )
  }

  render() {
    var classes = classnames({
                    'react-comment-box-smarttextarea': true
                });
    var containerStyle = {width: this.props.width};

    return (
      <div
        style={containerStyle}
        className="react-comment-box-smarttextarea__outerdiv"
        ref='smarttextareaContainer'>
        <div className={classes}>
          <div className="react-comment-box-smarttextarea__innerdiv">
            {this.getGhostDivContent()}
            <TextAreaAutosize
                defaultValue={this.props.defaultValue}
                placeholder={this.props.placeholder}
                onClick={this.handleTextareaClick.bind(this)}
                onChange={this.handleInputChange.bind(this)}
                onKeyPress={this.handleKeyPress.bind(this)}
                onKeyDown={this.handleKeyDown.bind(this)}
                onKeyUp={this.handleKeyUp.bind(this)}
                onFocus={this.handleFocus.bind(this)}
                onBlur={this.handleBlur.bind(this)}
                className='react-comment-box-smarttextarea__textarea'
                value={this.state.contentText}
                ref='newPostTextArea'
                >
            </TextAreaAutosize>
            {this.state.showAtRef && false ? this.getAtrefComponent() : ''}
          </div>
        </div>
      </div>
    );
  }
};

SmartTextArea.propTypes = {
  getListComponent: PropTypes.func,
  defaultValue: PropTypes.string,
  placeholder: PropTypes.string
};

SmartTextArea.defaultProps = {
  width: 300,
  placeholder: 'Hey there! Share your moment! Now?',
  defaultValue: '',
  type: 'default'
};

export default SmartTextArea;