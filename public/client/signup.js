Shortly.signup = Backbone.View.extend({
  
  template: Templates['signup'],
  
  events: {},
  
  render: () => {
    this.$el.html( this.template() );
    return this;
  },
});