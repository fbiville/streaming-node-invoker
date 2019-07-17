
module.exports = class RawIndexedOutput {
	constructor(index, contentType, value) {
		this.index = index;
		this.contentType = contentType;
		this.value = value;
	}
}